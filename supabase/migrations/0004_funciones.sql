-- ============================================================================
--  Plantas de Camila — Funciones de escritura
--  Ejecutar DESPUÉS de 0003_datos_iniciales.sql
-- ============================================================================
--
--  ¿POR QUÉ UNA FUNCIÓN Y NO DOS INSERTS DESDE LA APP?
--
--  Una venta son dos escrituras: la cabecera y sus líneas. Desde el navegador
--  eso son dos llamadas HTTP separadas, y si la segunda falla (se cortó el
--  datos justo ahí, cosa normal en un local), queda una venta de $0 con cero
--  productos y el stock sin descontar. Nada lo deshace.
--
--  Dentro de una función de Postgres las dos escrituras son UNA transacción:
--  o queda todo, o no queda nada.
--
--  `security invoker` es a propósito: la función corre con los permisos de
--  quien llama, así que las políticas RLS se siguen aplicando. No es una
--  puerta trasera.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Registrar una venta completa
-- ---------------------------------------------------------------------------
--  p_items: [{ planta_id, nombre, cantidad, precio_unitario, precio_lista,
--              promocion_id }]
--
--  Los totales NO se reciben: los calculan los triggers desde las líneas. Así
--  la app no puede guardar un total que no cuadre con lo que vendió.
create or replace function public.registrar_venta(
  p_items          jsonb,
  p_canal          text default 'tienda',
  p_metodo_pago    text default 'efectivo',
  p_cliente_id     uuid default null,
  p_cliente_nombre text default null,
  p_cliente_telefono text default null,
  p_notas          text default null
)
-- `returns table` y no `returns public.ventas`: un tipo compuesto viaja por
-- PostgREST como un objeto suelto, mientras que `returns table` viaja como
-- array — que es lo que `.single()` del cliente espera. Además devolver sólo
-- tres campos deja un contrato más chico que toda la fila.
returns table (
  venta_id uuid,
  folio    bigint,
  total    int
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta   public.ventas;
  v_cliente uuid := p_cliente_id;
  v_item    jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene ninguna planta';
  end if;

  -- Clienta nueva escrita a mano en la pantalla de cobro: se crea al vuelo,
  -- sin obligar a Camila a ir a otra pantalla antes de cobrar.
  if v_cliente is null and nullif(btrim(p_cliente_nombre), '') is not null then
    insert into public.clientes (nombre, telefono)
    values (btrim(p_cliente_nombre), nullif(btrim(p_cliente_telefono), ''))
    returning id into v_cliente;
  end if;

  insert into public.ventas (canal, metodo_pago, cliente_id, notas)
  values (p_canal, p_metodo_pago, v_cliente, nullif(btrim(p_notas), ''))
  returning * into v_venta;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.venta_items (
      venta_id, planta_id, nombre_planta,
      cantidad, precio_unitario, precio_lista, promocion_id
    )
    values (
      v_venta.id,
      nullif(v_item->>'planta_id', '')::uuid,
      coalesce(nullif(btrim(v_item->>'nombre'), ''), 'Sin nombre'),
      greatest(coalesce((v_item->>'cantidad')::int, 1), 1),
      greatest(coalesce((v_item->>'precio_unitario')::int, 0), 0),
      greatest(coalesce((v_item->>'precio_lista')::int, 0), 0),
      nullif(v_item->>'promocion_id', '')::uuid
    );
  end loop;

  -- Releer: los triggers ya escribieron subtotal / descuento / total.
  return query
    select v.id, v.folio, v.total
      from public.ventas v
     where v.id = v_venta.id;
end;
$$;

grant execute on function public.registrar_venta(
  jsonb, text, text, uuid, text, text, text
) to authenticated;


-- ---------------------------------------------------------------------------
-- Anular una venta
-- ---------------------------------------------------------------------------
--  Borra la venta; el ON DELETE CASCADE borra las líneas y el trigger de stock
--  devuelve las plantas al inventario. Los movimientos quedan registrados, así
--  que la anulación es auditable.
create or replace function public.anular_venta(p_venta_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.ventas where id = p_venta_id;
  if not found then
    raise exception 'Esa venta no existe';
  end if;
end;
$$;

grant execute on function public.anular_venta(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Mover stock a mano (reposición, ajuste de conteo, merma)
-- ---------------------------------------------------------------------------
--  Nunca se toca `plantas.stock` directamente desde la app: todo pasa por acá,
--  para que el inventario siempre tenga historial.
create or replace function public.mover_stock(
  p_planta_id uuid,
  p_cantidad  int,
  p_tipo      text default 'ingreso',
  p_nota      text default null
)
-- Devuelve el stock que quedó. Escalar y no la fila completa: es lo único que
-- le interesa a quien llama, y así el contrato no cambia si mañana la tabla
-- `plantas` gana columnas.
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_stock int;
begin
  if p_cantidad = 0 then
    raise exception 'La cantidad no puede ser cero';
  end if;

  insert into public.movimientos_stock (planta_id, tipo, cantidad, nota)
  values (p_planta_id, p_tipo, p_cantidad, nullif(btrim(p_nota), ''));

  select stock into v_stock from public.plantas where id = p_planta_id;
  return v_stock;
end;
$$;

grant execute on function public.mover_stock(uuid, int, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- Reconstruir el stock desde los movimientos
-- ---------------------------------------------------------------------------
--  `plantas.stock` es una copia cacheada. Si algún día un número no cuadra,
--  esta función lo recalcula desde la fuente de verdad. Es la red de seguridad
--  que hace que valga la pena tener la tabla de movimientos.
create or replace function public.recalcular_stock()
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_filas int;
begin
  update public.plantas p
     set stock = coalesce((
           select sum(m.cantidad)::int
             from public.movimientos_stock m
            where m.planta_id = p.id
         ), 0),
         actualizada_en = now()
   where p.stock is distinct from coalesce((
           select sum(m.cantidad)::int
             from public.movimientos_stock m
            where m.planta_id = p.id
         ), 0);
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

grant execute on function public.recalcular_stock() to authenticated;
