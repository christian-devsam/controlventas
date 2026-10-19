-- ============================================================================
--  Plantas de Camila — Funciones del panel (agregados por rango de fechas)
--  Ejecutar DESPUÉS de 0004_funciones.sql
-- ============================================================================
--
--  Las vistas de 0002 agregan TODO el histórico. Sirven para explorar con SQL,
--  pero el panel necesita algo más: que un único selector de período
--  (7 / 30 / 90 días) afecte a todos los gráficos a la vez.
--
--  Si cada gráfico trajera su propio rango, dos tarjetas lado a lado podrían
--  estar mostrando períodos distintos sin avisar. Por eso el rango es un
--  parámetro de la consulta, no un filtro de cada gráfico.
--
--  Todas reciben `p_dias` y comparan contra el período inmediatamente anterior
--  de IGUAL duración, así la comparación siempre es entre iguales.
--
--  Nota de rendimiento: filtrar por `(fecha at time zone …)::date` no usa el
--  índice de `fecha`. Con el volumen de una tienda de barrio (miles de filas,
--  no millones) es irrelevante y la claridad vale más. Si algún día molesta,
--  la solución es un índice sobre la expresión.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- KPIs del encabezado, con comparación contra el período anterior
-- ---------------------------------------------------------------------------
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
  ventas_hoy        int
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
  )
  -- Los paréntesis alrededor de cada `count(...) filter (...)` no son adorno:
  -- sin ellos el `::int` se pega al FILTER y Postgres no parsea.
  select
    coalesce(sum(v.total) filter (where v.dia between p.desde and p.hasta), 0)::int,
    (count(v.id) filter (where v.dia between p.desde and p.hasta))::int,
    coalesce(sum(u.unidades) filter (where v.dia between p.desde and p.hasta), 0)::int,
    coalesce(sum(v.descuento_total) filter (where v.dia between p.desde and p.hasta), 0)::int,
    coalesce(round(avg(v.total) filter (where v.dia between p.desde and p.hasta)), 0)::int,
    coalesce(sum(v.total) filter (where v.dia between p.desde_previo and p.hasta_previo), 0)::int,
    (count(v.id) filter (where v.dia between p.desde_previo and p.hasta_previo))::int,
    coalesce(sum(v.total) filter (where v.dia = current_date), 0)::int,
    (count(v.id) filter (where v.dia = current_date))::int
  from p
  left join v on true
  left join u on u.venta_id = v.id;
$$;

grant execute on function public.panel_kpis(int) to authenticated;


-- ---------------------------------------------------------------------------
-- Serie diaria — incluye los días sin ventas
-- ---------------------------------------------------------------------------
--  `generate_series` es clave acá: sin eso, un día sin ventas simplemente no
--  existe en el resultado y la línea del gráfico une el día 3 con el día 5
--  como si fueran consecutivos. El bajón desaparece del gráfico justo cuando
--  es lo más importante de ver.
create or replace function public.panel_serie_diaria(p_dias int default 30)
returns table (
  dia             date,
  ingresos        int,
  ventas          int,
  unidades        int,
  ticket_promedio int
)
language sql
stable
security invoker
set search_path = public
as $$
  with dias as (
    select generate_series(
      current_date - (p_dias - 1),
      current_date,
      interval '1 day'
    )::date as dia
  ),
  agregado as (
    select
      (v.fecha at time zone 'America/Santiago')::date as dia,
      sum(v.total)::int                               as ingresos,
      count(*)::int                                   as ventas,
      coalesce(sum(u.unidades), 0)::int                as unidades,
      round(avg(v.total))::int                        as ticket_promedio
    from public.ventas v
    left join (
      select venta_id, sum(cantidad)::int as unidades
        from public.venta_items group by venta_id
    ) u on u.venta_id = v.id
    where (v.fecha at time zone 'America/Santiago')::date
          >= current_date - (p_dias - 1)
    group by 1
  )
  select
    d.dia,
    coalesce(a.ingresos, 0),
    coalesce(a.ventas, 0),
    coalesce(a.unidades, 0),
    coalesce(a.ticket_promedio, 0)
  from dias d
  left join agregado a on a.dia = d.dia
  order by d.dia;
$$;

grant execute on function public.panel_serie_diaria(int) to authenticated;


-- ---------------------------------------------------------------------------
-- Ranking de plantas del período
-- ---------------------------------------------------------------------------
create or replace function public.panel_top_plantas(
  p_dias   int default 30,
  p_limite int default 8
)
returns table (
  nombre_planta          text,
  categoria              text,
  unidades               int,
  ingresos               int,
  precio_promedio        int,
  descuento_promedio_pct numeric
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
    round(avg(vi.precio_unitario))::int,
    case
      when sum(vi.cantidad * vi.precio_lista) = 0 then 0
      else round(
        100.0 * sum(vi.cantidad * greatest(vi.precio_lista - vi.precio_unitario, 0))
              / sum(vi.cantidad * vi.precio_lista)
      , 1)
    end
  from public.venta_items vi
  join public.ventas v on v.id = vi.venta_id
  left join public.plantas p on p.id = vi.planta_id
  where (v.fecha at time zone 'America/Santiago')::date
        >= current_date - (p_dias - 1)
  group by vi.nombre_planta, p.categoria
  order by 4 desc
  limit p_limite;
$$;

grant execute on function public.panel_top_plantas(int, int) to authenticated;


-- ---------------------------------------------------------------------------
-- Ingresos por categoría del período
-- ---------------------------------------------------------------------------
create or replace function public.panel_categorias(p_dias int default 30)
returns table (
  categoria text,
  unidades  int,
  ingresos  int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(p.categoria, 'Sin categoría'),
    sum(vi.cantidad)::int,
    sum(vi.subtotal)::int
  from public.venta_items vi
  join public.ventas v on v.id = vi.venta_id
  left join public.plantas p on p.id = vi.planta_id
  where (v.fecha at time zone 'America/Santiago')::date
        >= current_date - (p_dias - 1)
  group by 1
  order by 3 desc;
$$;

grant execute on function public.panel_categorias(int) to authenticated;


-- ---------------------------------------------------------------------------
-- Mapa de calor: día de la semana × bloque horario
-- ---------------------------------------------------------------------------
--  Un heatmap de 7 × 24 en un teléfono es ilegible y, con el volumen de una
--  tienda de barrio, queda casi todo vacío. Agrupando en cuatro bloques la
--  grilla pasa a 7 × 4: cabe en pantalla y cada celda tiene datos suficientes
--  para decir algo.
--
--  Responde: ¿qué día y a qué hora conviene estar en el local, hacer una
--  promo, o publicar en Instagram?
create or replace function public.panel_mapa_horario(p_dias int default 90)
returns table (
  dia_num    int,
  dia_nombre text,
  bloque     int,
  bloque_nombre text,
  ventas     int,
  ingresos   int
)
language sql
stable
security invoker
set search_path = public
as $$
  with bloques as (
    -- Nombres y no rangos de hora: una venta a las 8 de la mañana cae en el
    -- primer bloque, y una a las 22 en el último. Si la etiqueta dijera
    -- "9–12" y "18–21" estaría mintiendo en los bordes.
    select * from (values
      (1, 'Mañana'), (2, 'Mediodía'), (3, 'Tarde'), (4, 'Noche')
    ) as b(bloque, bloque_nombre)
  ),
  dias as (
    select * from (values
      (1, 'Lun'), (2, 'Mar'), (3, 'Mié'), (4, 'Jue'),
      (5, 'Vie'), (6, 'Sáb'), (7, 'Dom')
    ) as d(dia_num, dia_nombre)
  ),
  agregado as (
    select
      extract(isodow from v.fecha at time zone 'America/Santiago')::int as dia_num,
      case
        when extract(hour from v.fecha at time zone 'America/Santiago') < 12 then 1
        when extract(hour from v.fecha at time zone 'America/Santiago') < 15 then 2
        when extract(hour from v.fecha at time zone 'America/Santiago') < 18 then 3
        else 4
      end as bloque,
      count(*)::int     as ventas,
      sum(v.total)::int as ingresos
    from public.ventas v
    where (v.fecha at time zone 'America/Santiago')::date
          >= current_date - (p_dias - 1)
    group by 1, 2
  )
  -- Grilla completa: las celdas sin ventas valen 0, no desaparecen. Un hueco
  -- en el mapa es información ("ese día no vendo nada"), no ausencia de dato.
  select
    d.dia_num, d.dia_nombre,
    b.bloque, b.bloque_nombre,
    coalesce(a.ventas, 0),
    coalesce(a.ingresos, 0)
  from dias d
  cross join bloques b
  left join agregado a on a.dia_num = d.dia_num and a.bloque = b.bloque
  order by d.dia_num, b.bloque;
$$;

grant execute on function public.panel_mapa_horario(int) to authenticated;


-- ---------------------------------------------------------------------------
-- Impacto de las promociones en el período
-- ---------------------------------------------------------------------------
create or replace function public.panel_promociones(p_dias int default 30)
returns table (
  nombre            text,
  tipo              text,
  ventas_con_promo  int,
  unidades          int,
  ingreso_generado  int,
  ingreso_resignado int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    pr.nombre,
    pr.tipo,
    count(distinct vi.venta_id)::int,
    sum(vi.cantidad)::int,
    sum(vi.subtotal)::int,
    sum(vi.cantidad * greatest(vi.precio_lista - vi.precio_unitario, 0))::int
  from public.venta_items vi
  join public.ventas v on v.id = vi.venta_id
  join public.promociones pr on pr.id = vi.promocion_id
  where (v.fecha at time zone 'America/Santiago')::date
        >= current_date - (p_dias - 1)
  group by pr.nombre, pr.tipo
  order by 5 desc;
$$;

grant execute on function public.panel_promociones(int) to authenticated;
