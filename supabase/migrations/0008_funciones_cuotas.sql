-- ============================================================================
--  Plantas de Camila — Funciones de cuotas, pagos y utilidad
--  Ejecutar DESPUÉS de 0007_cuotas_y_utilidad.sql
-- ============================================================================

-- La firma de `registrar_venta` cambia (ahora recibe el plan de cuotas), así
-- que se elimina la vieja. Si se dejara, Postgres tendría dos versiones
-- conviviendo y PostgREST elegiría una según los parámetros que lleguen —
-- justo el tipo de ambigüedad que arruina una tarde.
drop function if exists public.registrar_venta(jsonb, text, text, uuid, text, text, text);


-- ---------------------------------------------------------------------------
-- Registrar una venta (al contado o en cuotas)
-- ---------------------------------------------------------------------------
--  p_items:  [{ planta_id, nombre, cantidad, precio_unitario, precio_lista,
--               promocion_id }]
--  p_cuotas: cantidad de cuotas. 0 o 1 = venta al contado.
--  p_abono_inicial: el "pie". Se guarda como primer pago, no como cuota.
--  p_primer_vence: fecha de la primera cuota. Por defecto, en un mes.
--
--  El costo NO se recibe: se lee de la planta acá adentro y se congela en la
--  línea. Si viniera del navegador, un error de la app podría escribir una
--  utilidad falsa en el histórico.
create or replace function public.registrar_venta(
  p_items            jsonb,
  p_canal            text    default 'tienda',
  p_metodo_pago      text    default 'efectivo',
  p_cliente_id       uuid    default null,
  p_cliente_nombre   text    default null,
  p_cliente_telefono text    default null,
  p_notas            text    default null,
  p_cuotas           int     default 0,
  p_abono_inicial    int     default 0,
  p_primer_vence     date    default null
)
returns table (
  venta_id uuid,
  folio    bigint,
  total    int,
  saldo    int
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta        public.ventas;
  v_cliente      uuid := p_cliente_id;
  v_item         jsonb;
  v_es_cuotas    boolean := coalesce(p_cuotas, 0) > 1;
  v_abono        int := greatest(coalesce(p_abono_inicial, 0), 0);
  v_resto        int;
  v_base         int;
  v_sobrante     int;
  v_monto        int;
  v_desde        date := coalesce(p_primer_vence, (current_date + interval '1 month')::date);
  i              int;
begin
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene ninguna planta';
  end if;

  -- Vender en cuotas es prestar plata: tiene que haber a quién cobrarle.
  if v_es_cuotas and v_cliente is null
     and nullif(btrim(p_cliente_nombre), '') is null then
    raise exception 'Una venta en cuotas necesita una clienta registrada';
  end if;

  if v_cliente is null and nullif(btrim(p_cliente_nombre), '') is not null then
    insert into public.clientes (nombre, telefono, es_confianza)
    values (btrim(p_cliente_nombre), nullif(btrim(p_cliente_telefono), ''), v_es_cuotas)
    returning id into v_cliente;
  end if;

  insert into public.ventas (canal, metodo_pago, cliente_id, notas, forma_pago)
  values (
    p_canal, p_metodo_pago, v_cliente, nullif(btrim(p_notas), ''),
    case when v_es_cuotas then 'cuotas' else 'contado' end
  )
  returning * into v_venta;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.venta_items (
      venta_id, planta_id, nombre_planta,
      cantidad, precio_unitario, precio_lista, promocion_id, costo_unitario
    )
    values (
      v_venta.id,
      nullif(v_item->>'planta_id', '')::uuid,
      coalesce(nullif(btrim(v_item->>'nombre'), ''), 'Sin nombre'),
      greatest(coalesce((v_item->>'cantidad')::int, 1), 1),
      greatest(coalesce((v_item->>'precio_unitario')::int, 0), 0),
      greatest(coalesce((v_item->>'precio_lista')::int, 0), 0),
      nullif(v_item->>'promocion_id', '')::uuid,
      -- El costo sale de la planta, acá, ahora. Queda congelado para siempre.
      (select pl.costo from public.plantas pl
        where pl.id = nullif(v_item->>'planta_id', '')::uuid)
    );
  end loop;

  -- Releer: los triggers ya calcularon el total desde las líneas.
  select * into v_venta from public.ventas where id = v_venta.id;

  if v_es_cuotas then
    if v_abono > v_venta.total then
      raise exception 'El abono inicial no puede ser mayor que el total';
    end if;

    if v_abono > 0 then
      insert into public.pagos (venta_id, monto, metodo_pago, nota)
      values (v_venta.id, v_abono, p_metodo_pago, 'Abono inicial');
    end if;

    v_resto := v_venta.total - v_abono;

    -- Reparto en pesos enteros. La división deja un resto de hasta
    -- (p_cuotas - 1) pesos; se suma a las PRIMERAS cuotas, de a uno. Así la
    -- suma de las cuotas da exactamente el saldo y nunca queda un peso
    -- colgando que haga que la deuda no cierre nunca.
    v_base     := v_resto / p_cuotas;
    v_sobrante := v_resto % p_cuotas;

    for i in 1..p_cuotas loop
      v_monto := v_base + case when i <= v_sobrante then 1 else 0 end;
      insert into public.cuotas (venta_id, numero, monto, vence)
      values (
        v_venta.id, i, v_monto,
        (v_desde + ((i - 1) * interval '1 month'))::date
      );
    end loop;
  end if;

  return query
    select v.id, v.folio, v.total,
           v.total - coalesce((
             select sum(pg.monto)::int from public.pagos pg where pg.venta_id = v.id
           ), 0)
      from public.ventas v
     where v.id = v_venta.id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Registrar un abono
-- ---------------------------------------------------------------------------
create or replace function public.registrar_pago(
  p_venta_id    uuid,
  p_monto       int,
  p_metodo_pago text default 'efectivo',
  p_nota        text default null
)
returns table (pagado int, saldo int)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total  int;
  v_pagado int;
begin
  if p_monto <= 0 then
    raise exception 'El abono tiene que ser mayor que cero';
  end if;

  select v.total into v_total from public.ventas v where v.id = p_venta_id;
  if v_total is null then
    raise exception 'Esa venta no existe';
  end if;

  select coalesce(sum(pg.monto), 0)::int into v_pagado
    from public.pagos pg where pg.venta_id = p_venta_id;

  -- Se puede pagar justo, no de más. Aceptar un pago mayor al saldo dejaría
  -- a la venta "debiendo negativo", que no significa nada.
  if v_pagado + p_monto > v_total then
    raise exception 'El abono supera el saldo pendiente (quedan %)', v_total - v_pagado;
  end if;

  insert into public.pagos (venta_id, monto, metodo_pago, nota)
  values (p_venta_id, p_monto, p_metodo_pago, nullif(btrim(p_nota), ''));

  return query
    select (v_pagado + p_monto), (v_total - v_pagado - p_monto);
end;
$$;


-- ---------------------------------------------------------------------------
-- Marcar a una clienta como de confianza
-- ---------------------------------------------------------------------------
create or replace function public.marcar_confianza(
  p_cliente_id uuid,
  p_confianza  boolean,
  p_limite     int default null
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.clientes
     set es_confianza   = p_confianza,
         limite_credito = case when p_confianza then p_limite else null end
   where id = p_cliente_id;
$$;


-- ============================================================================
--  UTILIDAD
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Utilidad por planta en el período
-- ---------------------------------------------------------------------------
--  Devuelve lo necesario para los DOS rankings que pide el negocio (mayor
--  utilidad y más vendida) en una sola consulta: son las mismas filas
--  ordenadas distinto, no dos preguntas diferentes.
--
--  `unidades_sin_costo` es la columna honesta: dice cuántas unidades se
--  vendieron sin costo cargado. Esas no entran en la utilidad. Sin este dato
--  un margen del 100% parecería un golazo cuando en realidad es un costo que
--  falta cargar.
create or replace function public.panel_utilidad(
  p_dias   int default 30,
  p_limite int default 50
)
returns table (
  nombre_planta      text,
  categoria          text,
  unidades           int,
  ingresos           int,
  costo_total        int,
  utilidad           int,
  margen_pct         numeric,
  unidades_sin_costo int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    vi.nombre_planta,
    coalesce(p.categoria, 'Sin categoría'),
    sum(vi.cantidad)::int,
    sum(vi.subtotal)::int,
    coalesce(sum(vi.cantidad * vi.costo_unitario) filter (where vi.costo_unitario is not null), 0)::int,
    -- Sólo las líneas con costo conocido suman a la utilidad.
    coalesce(sum(
      vi.cantidad * (vi.precio_unitario - vi.costo_unitario)
    ) filter (where vi.costo_unitario is not null), 0)::int,
    case
      when coalesce(sum(vi.subtotal) filter (where vi.costo_unitario is not null), 0) = 0 then 0
      else round(
        100.0 * sum(vi.cantidad * (vi.precio_unitario - vi.costo_unitario))
                  filter (where vi.costo_unitario is not null)
              / sum(vi.subtotal) filter (where vi.costo_unitario is not null)
      , 1)
    end,
    coalesce(sum(vi.cantidad) filter (where vi.costo_unitario is null), 0)::int
  from public.venta_items vi
  join public.ventas v on v.id = vi.venta_id
  left join public.plantas p on p.id = vi.planta_id
  where (v.fecha at time zone 'America/Santiago')::date
        >= current_date - (p_dias - 1)
  group by vi.nombre_planta, p.categoria
  order by 6 desc
  limit p_limite;
$$;


-- ---------------------------------------------------------------------------
-- KPIs ampliados: vendido vs. cobrado, por cobrar, y utilidad
-- ---------------------------------------------------------------------------
--  `ingresos` sigue siendo lo VENDIDO (devengado) y `cobrado` es la plata que
--  realmente entró por caja en el período. Con ventas en cuotas los dos
--  números se separan, y mostrar sólo el primero haría creer que hay plata
--  que todavía no llegó.
create or replace function public.panel_kpis(p_dias int default 30)
returns table (
  ingresos          int,
  ventas            int,
  unidades          int,
  descuentos        int,
  ticket_promedio   int,
  ingresos_previo   int,
  ventas_previo     int,
  ingresos_hoy      int,
  ventas_hoy        int,
  cobrado           int,
  por_cobrar        int,
  vencido           int,
  utilidad          int,
  unidades_sin_costo int
)
language sql
stable
security invoker
set search_path = public
as $$
  with p as (
    select
      (current_date - (p_dias - 1))     as desde,
      current_date                      as hasta,
      (current_date - (2 * p_dias - 1)) as desde_previo,
      (current_date - p_dias)           as hasta_previo
  ),
  v as (
    select
      ventas.total,
      ventas.descuento_total,
      ventas.id,
      (ventas.fecha at time zone 'America/Santiago')::date as dia
    from public.ventas
  ),
  u as (
    select vi.venta_id, sum(vi.cantidad)::int as unidades
      from public.venta_items vi
     group by vi.venta_id
  ),
  base as (
    select
      coalesce(sum(v.total) filter (where v.dia between p.desde and p.hasta), 0)::int as ingresos,
      (count(v.id) filter (where v.dia between p.desde and p.hasta))::int             as ventas,
      coalesce(sum(u.unidades) filter (where v.dia between p.desde and p.hasta), 0)::int as unidades,
      coalesce(sum(v.descuento_total) filter (where v.dia between p.desde and p.hasta), 0)::int as descuentos,
      coalesce(round(avg(v.total) filter (where v.dia between p.desde and p.hasta)), 0)::int as ticket_promedio,
      coalesce(sum(v.total) filter (where v.dia between p.desde_previo and p.hasta_previo), 0)::int as ingresos_previo,
      (count(v.id) filter (where v.dia between p.desde_previo and p.hasta_previo))::int as ventas_previo,
      coalesce(sum(v.total) filter (where v.dia = current_date), 0)::int as ingresos_hoy,
      (count(v.id) filter (where v.dia = current_date))::int             as ventas_hoy
    from p
    left join v on true
    left join u on u.venta_id = v.id
  ),
  caja as (
    -- Plata que entró de verdad: pagos de ventas en cuotas más el total de
    -- las ventas al contado del período.
    select
      coalesce((
        select sum(pg.monto)::int from public.pagos pg
         where (pg.fecha at time zone 'America/Santiago')::date
               between (select desde from p) and (select hasta from p)
      ), 0)
      +
      coalesce((
        select sum(vt.total)::int from public.ventas vt
         where vt.forma_pago = 'contado'
           and (vt.fecha at time zone 'America/Santiago')::date
               between (select desde from p) and (select hasta from p)
      ), 0) as cobrado
  ),
  deuda as (
    select
      coalesce(sum(saldo)::int, 0)   as por_cobrar,
      coalesce(sum(vencido)::int, 0) as vencido
    from public.v_deudas
  ),
  margen as (
    select
      coalesce(sum(
        vi.cantidad * (vi.precio_unitario - vi.costo_unitario)
      ) filter (where vi.costo_unitario is not null), 0)::int as utilidad,
      coalesce(sum(vi.cantidad) filter (where vi.costo_unitario is null), 0)::int as unidades_sin_costo
    from public.venta_items vi
    join public.ventas vt on vt.id = vi.venta_id
    where (vt.fecha at time zone 'America/Santiago')::date
          between (select desde from p) and (select hasta from p)
  )
  select
    base.ingresos, base.ventas, base.unidades, base.descuentos,
    base.ticket_promedio, base.ingresos_previo, base.ventas_previo,
    base.ingresos_hoy, base.ventas_hoy,
    caja.cobrado, deuda.por_cobrar, deuda.vencido,
    margen.utilidad, margen.unidades_sin_costo
  from base, caja, deuda, margen;
$$;


grant execute on function public.registrar_venta(
  jsonb, text, text, uuid, text, text, text, int, int, date
) to service_role;
grant execute on function public.registrar_pago(uuid, int, text, text) to service_role;
grant execute on function public.marcar_confianza(uuid, boolean, int) to service_role;
grant execute on function public.panel_utilidad(int, int) to service_role;
grant execute on function public.panel_kpis(int) to service_role;
