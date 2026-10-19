-- ============================================================================
--  Plantas de Camila — Vistas analíticas
--  Ejecutar DESPUÉS de 0001_esquema.sql
-- ============================================================================
--
--  Cada vista responde una pregunta concreta del negocio. El dashboard sólo
--  las consulta; no hace cálculos en el teléfono.
--
--  NOTA SOBRE LA ZONA HORARIA: todo se agrupa en hora de Santiago, no en UTC.
--  Sin esto, una venta de las 22:00 del martes aparecería como miércoles y los
--  reportes diarios quedarían corridos.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ventas por día — la línea de tiempo del negocio
-- ---------------------------------------------------------------------------
create or replace view public.v_ventas_dia
with (security_invoker = true) as
select
  (v.fecha at time zone 'America/Santiago')::date as dia,
  count(*)                                        as ventas,
  coalesce(sum(vi.unidades), 0)::int              as unidades,
  sum(v.total)::int                               as ingresos,
  sum(v.descuento_total)::int                     as descuentos,
  round(avg(v.total))::int                        as ticket_promedio
from public.ventas v
left join (
  select venta_id, sum(cantidad) as unidades
    from public.venta_items
   group by venta_id
) vi on vi.venta_id = v.id
group by 1
order by 1;

-- ---------------------------------------------------------------------------
-- 2. Ranking de plantas — ¿qué vender más y qué dejar de traer?
-- ---------------------------------------------------------------------------
--  `descuento_promedio_pct` es la métrica escondida que más importa: una
--  planta puede ser la más vendida y a la vez la que más margen regala.
create or replace view public.v_top_plantas
with (security_invoker = true) as
select
  vi.planta_id,
  vi.nombre_planta,
  coalesce(p.categoria, 'Sin categoría')          as categoria,
  sum(vi.cantidad)::int                           as unidades,
  sum(vi.subtotal)::int                           as ingresos,
  round(avg(vi.precio_unitario))::int             as precio_promedio,
  count(distinct vi.venta_id)::int                as veces_vendida,
  case
    when sum(vi.cantidad * vi.precio_lista) = 0 then 0
    else round(
      100.0 * sum(vi.cantidad * greatest(vi.precio_lista - vi.precio_unitario, 0))
            / sum(vi.cantidad * vi.precio_lista)
    , 1)
  end                                             as descuento_promedio_pct,
  max(v.fecha)                                    as ultima_venta
from public.venta_items vi
join public.ventas v on v.id = vi.venta_id
left join public.plantas p on p.id = vi.planta_id
group by vi.planta_id, vi.nombre_planta, p.categoria
order by ingresos desc;

-- ---------------------------------------------------------------------------
-- 3. Ingresos por categoría — ¿en qué rubro está la plata?
-- ---------------------------------------------------------------------------
create or replace view public.v_ventas_categoria
with (security_invoker = true) as
select
  coalesce(p.categoria, 'Sin categoría') as categoria,
  sum(vi.cantidad)::int                  as unidades,
  sum(vi.subtotal)::int                  as ingresos
from public.venta_items vi
left join public.plantas p on p.id = vi.planta_id
group by 1
order by ingresos desc;

-- ---------------------------------------------------------------------------
-- 4. Ventas por hora del día — ¿cuándo conviene estar en el local?
-- ---------------------------------------------------------------------------
create or replace view public.v_ventas_hora
with (security_invoker = true) as
select
  extract(hour from v.fecha at time zone 'America/Santiago')::int as hora,
  count(*)::int     as ventas,
  sum(v.total)::int as ingresos
from public.ventas v
group by 1
order by 1;

-- ---------------------------------------------------------------------------
-- 5. Ventas por día de la semana — ¿qué día cerrar o hacer promo?
-- ---------------------------------------------------------------------------
create or replace view public.v_ventas_dia_semana
with (security_invoker = true) as
select
  extract(isodow from v.fecha at time zone 'America/Santiago')::int as dia_num,
  case extract(isodow from v.fecha at time zone 'America/Santiago')::int
    when 1 then 'Lunes'    when 2 then 'Martes'  when 3 then 'Miércoles'
    when 4 then 'Jueves'   when 5 then 'Viernes' when 6 then 'Sábado'
    else 'Domingo'
  end                      as dia_nombre,
  count(*)::int            as ventas,
  sum(v.total)::int        as ingresos,
  round(avg(v.total))::int as ticket_promedio
from public.ventas v
group by 1, 2
order by 1;

-- ---------------------------------------------------------------------------
-- 6. Impacto de las promociones — ¿valen lo que cuestan?
-- ---------------------------------------------------------------------------
--  Compara lo que la promo dejó entrar contra lo que resignó. Si
--  `ingreso_resignado` es alto y `unidades` bajo, la promo no está funcionando.
create or replace view public.v_impacto_promociones
with (security_invoker = true) as
select
  pr.id                       as promocion_id,
  pr.nombre,
  pr.tipo,
  count(distinct vi.venta_id)::int as ventas_con_promo,
  sum(vi.cantidad)::int            as unidades,
  sum(vi.subtotal)::int            as ingreso_generado,
  sum(vi.cantidad * greatest(vi.precio_lista - vi.precio_unitario, 0))::int as ingreso_resignado,
  round(avg(vi.precio_unitario))::int as precio_promedio
from public.promociones pr
left join public.venta_items vi on vi.promocion_id = pr.id
group by pr.id, pr.nombre, pr.tipo
order by ingreso_generado desc nulls last;

-- ---------------------------------------------------------------------------
-- 7. Clientas que vuelven — el activo más valioso de un negocio físico
-- ---------------------------------------------------------------------------
create or replace view public.v_clientes_top
with (security_invoker = true) as
select
  c.id            as cliente_id,
  c.nombre,
  c.telefono,
  count(v.id)::int as compras,
  sum(v.total)::int as gasto_total,
  round(avg(v.total))::int as ticket_promedio,
  max(v.fecha)     as ultima_compra,
  (current_date - (max(v.fecha) at time zone 'America/Santiago')::date) as dias_sin_comprar
from public.clientes c
join public.ventas v on v.cliente_id = c.id
group by c.id, c.nombre, c.telefono
order by gasto_total desc;

-- ---------------------------------------------------------------------------
-- 8. Alerta de stock — qué reponer antes de quedarse sin nada que vender
-- ---------------------------------------------------------------------------
create or replace view public.v_stock_alerta
with (security_invoker = true) as
select
  p.id,
  p.nombre,
  p.categoria,
  p.stock,
  p.stock_minimo,
  p.precio_base,
  coalesce(ventas_30d.unidades, 0)::int as vendidas_ultimos_30d,
  case
    when coalesce(ventas_30d.unidades, 0) = 0 then null
    else round(p.stock / (ventas_30d.unidades / 30.0), 1)
  end as dias_de_stock_restante
from public.plantas p
left join (
  select vi.planta_id, sum(vi.cantidad) as unidades
    from public.venta_items vi
    join public.ventas v on v.id = vi.venta_id
   where v.fecha >= now() - interval '30 days'
   group by vi.planta_id
) ventas_30d on ventas_30d.planta_id = p.id
where p.activa
  and p.stock <= p.stock_minimo
order by p.stock asc, vendidas_ultimos_30d desc;

-- ---------------------------------------------------------------------------
-- 9. Ingresos por canal y medio de pago
-- ---------------------------------------------------------------------------
create or replace view public.v_ventas_canal
with (security_invoker = true) as
select
  v.canal,
  v.metodo_pago,
  count(*)::int     as ventas,
  sum(v.total)::int as ingresos
from public.ventas v
group by 1, 2
order by ingresos desc;

-- ---------------------------------------------------------------------------
-- 10. KPIs del encabezado del dashboard
-- ---------------------------------------------------------------------------
--  Una sola fila con los números que Camila quiere ver al abrir la app,
--  incluida la comparación contra el mes anterior.
create or replace view public.v_kpis
with (security_invoker = true) as
with hoy as (
  select current_date as d
),
rangos as (
  select
    (select d from hoy)                                as dia_hoy,
    date_trunc('month', (select d from hoy))::date     as inicio_mes,
    (date_trunc('month', (select d from hoy)) - interval '1 month')::date as inicio_mes_pasado
),
base as (
  select
    v.total,
    v.descuento_total,
    (v.fecha at time zone 'America/Santiago')::date as dia
  from public.ventas v
)
select
  -- Hoy
  coalesce(sum(b.total) filter (where b.dia = r.dia_hoy), 0)::int     as ingresos_hoy,
  -- Los paréntesis alrededor del `count(...) filter (...)` son necesarios:
  -- sin ellos el `::int` se pega al FILTER y Postgres no parsea.
  (count(b.total) filter (where b.dia = r.dia_hoy))::int              as ventas_hoy,
  -- Mes en curso
  coalesce(sum(b.total) filter (where b.dia >= r.inicio_mes), 0)::int as ingresos_mes,
  (count(b.total) filter (where b.dia >= r.inicio_mes))::int          as ventas_mes,
  coalesce(sum(b.descuento_total) filter (where b.dia >= r.inicio_mes), 0)::int as descuentos_mes,
  -- Mismo tramo del mes pasado, para comparar peras con peras
  coalesce(sum(b.total) filter (
    where b.dia >= r.inicio_mes_pasado and b.dia < r.inicio_mes
  ), 0)::int                                                          as ingresos_mes_pasado,
  -- Últimos 30 días
  coalesce(sum(b.total) filter (where b.dia >= r.dia_hoy - 29), 0)::int as ingresos_30d,
  coalesce(round(avg(b.total) filter (where b.dia >= r.dia_hoy - 29)), 0)::int as ticket_promedio_30d
-- LEFT JOIN y no cross join: así la vista devuelve una fila de ceros
-- cuando todavía no hay ninguna venta registrada, en vez de cero filas.
from rangos r
left join base b on true
group by r.dia_hoy, r.inicio_mes, r.inicio_mes_pasado;
