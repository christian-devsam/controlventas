-- ============================================================================
--  Plantas de Camila — Esquema de control de ventas
--  Ejecutar en: Supabase > SQL Editor > New query > Run
-- ============================================================================
--
--  DECISIONES DE DISEÑO
--
--  1. Una venta = cabecera (`ventas`) + líneas (`venta_items`).
--     Si una clienta compra 3 plantas, es UNA venta con 3 líneas. Esto permite
--     medir el "ticket promedio", que es la métrica que más mueve el negocio.
--
--  2. El precio se congela en cada línea (`precio_unitario`).
--     Los precios variables no son una excepción: son el caso normal. La línea
--     guarda a cuánto se vendió realmente, y además `precio_lista` (el precio
--     de catálogo en ese momento) para poder medir cuánto descuento se dio.
--
--  3. Montos en pesos chilenos como `integer`.
--     El CLP no tiene centavos. Usar enteros elimina de raíz los errores de
--     redondeo con decimales.
--
--  4. El stock es un valor derivado, no la verdad.
--     La verdad está en `movimientos_stock` (cada entrada/salida queda
--     registrada). `plantas.stock` es una copia que mantienen los triggers,
--     para poder leerla rápido. Si algún día el número no cuadra, se puede
--     reconstruir desde los movimientos.
--
--  5. Toda la agregación vive en vistas SQL (ver 0002_vistas.sql).
--     El teléfono no descarga miles de filas para dibujar un gráfico: Postgres
--     devuelve el resultado ya calculado.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Catálogo de plantas
-- ---------------------------------------------------------------------------
create table if not exists public.plantas (
  id            uuid primary key default gen_random_uuid(),
  -- `unique` no es sólo prolijidad: es lo que permite que el script de datos
  -- iniciales se pueda volver a correr sin duplicar el catálogo entero.
  nombre        text        not null unique,
  categoria     text        not null default 'Otras',
  precio_base   integer     not null check (precio_base >= 0),
  costo         integer              check (costo >= 0),   -- opcional: para margen
  stock         integer     not null default 0,
  stock_minimo  integer     not null default 3,
  emoji         text,                                      -- atajo visual en el grid
  activa        boolean     not null default true,
  creada_en     timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

-- Búsqueda por nombre sin acentos ni mayúsculas (el buscador de la pantalla
-- de venta tiene que encontrar "Potus" escribiendo "potu").
create index if not exists plantas_nombre_idx on public.plantas (lower(nombre));
create index if not exists plantas_activa_idx on public.plantas (activa) where activa;

-- ---------------------------------------------------------------------------
-- Clientas / clientes (opcional en cada venta)
-- ---------------------------------------------------------------------------
create table if not exists public.clientes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  telefono   text,
  instagram  text,
  comuna     text default 'Puente Alto',
  notas      text,
  creado_en  timestamptz not null default now()
);

create index if not exists clientes_nombre_idx on public.clientes (lower(nombre));

-- ---------------------------------------------------------------------------
-- Promociones
-- ---------------------------------------------------------------------------
--  El tipo define cómo la app calcula el precio sugerido, pero lo que se
--  GUARDA en la venta es el precio final. La promoción queda como etiqueta
--  para después poder responder: ¿cuánto me costó esta promo y qué trajo?
create table if not exists public.promociones (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  tipo       text not null check (tipo in ('porcentaje', 'monto_fijo', 'precio_fijo', 'pack')),
  valor      integer not null check (valor >= 0),
  activa     boolean not null default true,
  creada_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ventas (cabecera)
-- ---------------------------------------------------------------------------
create table if not exists public.ventas (
  id              uuid primary key default gen_random_uuid(),
  folio           bigint generated always as identity,  -- número legible: venta #41
  fecha           timestamptz not null default now(),
  cliente_id      uuid references public.clientes (id) on delete set null,
  canal           text not null default 'tienda'
                    check (canal in ('tienda', 'web', 'whatsapp', 'feria', 'instagram')),
  metodo_pago     text not null default 'efectivo'
                    check (metodo_pago in ('efectivo', 'transferencia', 'debito', 'credito', 'otro')),
  subtotal        integer not null default 0,  -- suma a precio de lista
  descuento_total integer not null default 0,  -- lo que se resignó vs. lista
  total           integer not null default 0,  -- lo que entró a la caja
  notas           text,
  registrada_por  uuid references auth.users (id) default auth.uid()
);

create index if not exists ventas_fecha_idx on public.ventas (fecha desc);
create index if not exists ventas_cliente_idx on public.ventas (cliente_id);

-- ---------------------------------------------------------------------------
-- Líneas de venta
-- ---------------------------------------------------------------------------
create table if not exists public.venta_items (
  id              uuid primary key default gen_random_uuid(),
  venta_id        uuid not null references public.ventas (id) on delete cascade,
  planta_id       uuid references public.plantas (id) on delete set null,
  nombre_planta   text not null,                 -- copia: si se borra la planta, el histórico sobrevive
  cantidad        integer not null default 1 check (cantidad > 0),
  precio_unitario integer not null check (precio_unitario >= 0),  -- lo que se cobró de verdad
  precio_lista    integer not null check (precio_lista >= 0),     -- lo que decía el catálogo
  promocion_id    uuid references public.promociones (id) on delete set null,
  subtotal        integer generated always as (cantidad * precio_unitario) stored
);

create index if not exists venta_items_venta_idx  on public.venta_items (venta_id);
create index if not exists venta_items_planta_idx on public.venta_items (planta_id);

-- ---------------------------------------------------------------------------
-- Movimientos de stock (la fuente de verdad del inventario)
-- ---------------------------------------------------------------------------
create table if not exists public.movimientos_stock (
  id          uuid primary key default gen_random_uuid(),
  planta_id   uuid not null references public.plantas (id) on delete cascade,
  tipo        text not null check (tipo in ('venta', 'ingreso', 'ajuste', 'merma', 'devolucion')),
  cantidad    integer not null,   -- negativo = sale del inventario
  venta_id    uuid references public.ventas (id) on delete set null,
  nota        text,
  creado_en   timestamptz not null default now()
);

create index if not exists movimientos_planta_idx on public.movimientos_stock (planta_id, creado_en desc);


-- ============================================================================
--  TRIGGERS
-- ============================================================================

-- --- 1. Aplicar cada movimiento al stock cacheado de la planta ---------------
create or replace function public.fn_aplicar_movimiento_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.plantas
     set stock = stock + new.cantidad,
         actualizada_en = now()
   where id = new.planta_id;
  return new;
end;
$$;

drop trigger if exists trg_aplicar_movimiento_stock on public.movimientos_stock;
create trigger trg_aplicar_movimiento_stock
  after insert on public.movimientos_stock
  for each row execute function public.fn_aplicar_movimiento_stock();


-- --- 2. Vender descuenta stock; borrar una venta lo devuelve -----------------
create or replace function public.fn_stock_desde_venta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.planta_id is not null then
      insert into public.movimientos_stock (planta_id, tipo, cantidad, venta_id, nota)
      values (new.planta_id, 'venta', -new.cantidad, new.venta_id, 'Venta registrada');
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    -- Se anuló la línea (o la venta completa): la planta vuelve al inventario.
    if old.planta_id is not null then
      insert into public.movimientos_stock (planta_id, tipo, cantidad, venta_id, nota)
      values (old.planta_id, 'devolucion', old.cantidad, null, 'Venta anulada');
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_stock_desde_venta on public.venta_items;
create trigger trg_stock_desde_venta
  after insert or delete on public.venta_items
  for each row execute function public.fn_stock_desde_venta();


-- --- 3. Recalcular los totales de la cabecera -------------------------------
--  Los totales nunca los manda el cliente: los deriva la base de datos desde
--  las líneas. Así la app no puede guardar un total que no cuadre.
create or replace function public.fn_recalcular_totales_venta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := coalesce(new.venta_id, old.venta_id);
begin
  -- Si la venta entera se está borrando, no hay nada que recalcular.
  if not exists (select 1 from public.ventas where id = v_id) then
    return null;
  end if;

  update public.ventas v
     set subtotal        = coalesce(t.subtotal, 0),
         descuento_total = coalesce(t.descuento, 0),
         total           = coalesce(t.total, 0)
    from (
      select sum(cantidad * precio_lista)                              as subtotal,
             sum(cantidad * greatest(precio_lista - precio_unitario, 0)) as descuento,
             sum(cantidad * precio_unitario)                           as total
        from public.venta_items
       where venta_id = v_id
    ) t
   where v.id = v_id;

  return null;
end;
$$;

drop trigger if exists trg_recalcular_totales_venta on public.venta_items;
create trigger trg_recalcular_totales_venta
  after insert or update or delete on public.venta_items
  for each row execute function public.fn_recalcular_totales_venta();


-- ============================================================================
--  SEGURIDAD (Row Level Security)
-- ============================================================================
--  RLS activo en todas las tablas. La `anon key` que va en el navegador no
--  sirve para leer nada por sí sola: hace falta una sesión de Supabase Auth.
--  Como la app la usa una sola persona, la regla es simple: usuaria
--  autenticada = acceso total. Si mañana entran vendedores, acá se cambia.

alter table public.plantas           enable row level security;
alter table public.clientes          enable row level security;
alter table public.promociones       enable row level security;
alter table public.ventas            enable row level security;
alter table public.venta_items       enable row level security;
alter table public.movimientos_stock enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['plantas', 'clientes', 'promociones', 'ventas', 'venta_items', 'movimientos_stock']
  loop
    execute format('drop policy if exists "acceso_autenticado" on public.%I', t);
    execute format(
      'create policy "acceso_autenticado" on public.%I
         for all to authenticated using (true) with check (true)', t);
  end loop;
end;
$$;
