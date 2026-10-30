-- ============================================================================
--  Plantas de Camila — Ventas en cuotas y utilidad
--  Ejecutar DESPUÉS de 0006_acceso.sql
-- ============================================================================
--
--  DOS COSAS, Y LAS DOS TOCAN EL NÚCLEO DEL MODELO
--
--  1. CUOTAS
--     Una venta en cuotas es un acuerdo: hay un plan de pago (cuánto y cuándo)
--     y hay pagos que van llegando. Son dos cosas distintas y acá viven en dos
--     tablas distintas: `cuotas` es lo que se ESPERA, `pagos` es lo que PASÓ.
--
--     Los pagos NO se atan a una cuota puntual. En la vida real nadie dice
--     "esto es para la cuota 2": dice "te abono $5.000". El saldo es
--     total − pagado, y qué cuota quedó cubierta se deduce. Atar cada pago a
--     una cuota obligaría a Camila a decidir algo que no le importa.
--
--  2. COSTO CONGELADO
--     `venta_items` gana `costo_unitario`, que se copia de la planta al vender.
--     Es la misma razón por la que ya se congela `precio_lista`: si la utilidad
--     se calculara contra `plantas.costo` actual, cada vez que el vivero sube
--     los precios se reescribiría la ganancia de todas las ventas viejas.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Clientas con crédito
-- ---------------------------------------------------------------------------
--  Vender en cuotas es prestar plata. `es_confianza` marca a quién se le
--  vende así: no es una etiqueta decorativa, es la que la app exige antes de
--  dejar armar un plan de pago.
alter table public.clientes
  add column if not exists es_confianza   boolean not null default false,
  add column if not exists limite_credito integer,
  add column if not exists notas_credito  text;

comment on column public.clientes.limite_credito is
  'Tope de deuda en pesos. NULL = sin tope definido.';


-- ---------------------------------------------------------------------------
-- La venta sabe cómo se paga
-- ---------------------------------------------------------------------------
alter table public.ventas
  add column if not exists forma_pago text not null default 'contado';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ventas_forma_pago_check'
  ) then
    alter table public.ventas
      add constraint ventas_forma_pago_check
      check (forma_pago in ('contado', 'cuotas'));
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- Costo congelado en la línea
-- ---------------------------------------------------------------------------
--  Nullable a propósito: hay plantas sin costo cargado, y las ventas que ya
--  existen no tienen forma de saberlo. Los reportes de utilidad cuentan
--  aparte cuántas líneas quedaron sin costo, en vez de asumir cero — asumir
--  cero inventaría una ganancia del 100%.
alter table public.venta_items
  add column if not exists costo_unitario integer;


-- ---------------------------------------------------------------------------
-- El plan de pago
-- ---------------------------------------------------------------------------
create table if not exists public.cuotas (
  id        uuid primary key default gen_random_uuid(),
  venta_id  uuid    not null references public.ventas (id) on delete cascade,
  numero    int     not null check (numero > 0),
  monto     integer not null check (monto >= 0),
  vence     date    not null,
  unique (venta_id, numero)
);

create index if not exists cuotas_venta_idx on public.cuotas (venta_id, numero);
create index if not exists cuotas_vence_idx on public.cuotas (vence);


-- ---------------------------------------------------------------------------
-- Los abonos
-- ---------------------------------------------------------------------------
create table if not exists public.pagos (
  id          uuid        primary key default gen_random_uuid(),
  venta_id    uuid        not null references public.ventas (id) on delete cascade,
  monto       integer     not null check (monto > 0),
  metodo_pago text        not null default 'efectivo'
                check (metodo_pago in ('efectivo', 'transferencia', 'debito', 'credito', 'otro')),
  fecha       timestamptz not null default now(),
  nota        text
);

create index if not exists pagos_venta_idx on public.pagos (venta_id, fecha);
create index if not exists pagos_fecha_idx on public.pagos (fecha desc);

alter table public.cuotas enable row level security;
alter table public.pagos  enable row level security;


-- ============================================================================
--  VISTAS DE DEUDA
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Una fila por venta a crédito con saldo pendiente
-- ---------------------------------------------------------------------------
create or replace view public.v_deudas
with (security_invoker = true) as
with pagado as (
  select venta_id, sum(monto)::int as pagado
    from public.pagos
   group by venta_id
),
plan as (
  select
    venta_id,
    count(*)::int                                                as total_cuotas,
    sum(monto)::int                                              as monto_plan,
    -- Lo que ya debería estar pagado a la fecha de hoy.
    coalesce(sum(monto) filter (where vence <= current_date), 0)::int as exigible_hoy
  from public.cuotas
  group by venta_id
)
select
  v.id                                        as venta_id,
  v.folio,
  v.fecha,
  c.id                                        as cliente_id,
  coalesce(c.nombre, 'Sin registrar')         as cliente,
  c.telefono,
  c.es_confianza,
  v.total,
  coalesce(p.pagado, 0)                       as pagado,
  v.total - coalesce(p.pagado, 0)             as saldo,
  -- Vencido = lo exigible a hoy menos lo que ya entró, nunca negativo.
  -- Si abonó de más, no "debe negativo": está al día.
  greatest(coalesce(pl.exigible_hoy, 0) - coalesce(p.pagado, 0), 0) as vencido,
  pl.total_cuotas,
  prox.numero                                 as proxima_cuota,
  prox.vence                                  as proximo_vence,
  prox.monto                                  as proximo_monto,
  (current_date - prox.vence)                 as dias_de_atraso
from public.ventas v
left join public.clientes c on c.id = v.cliente_id
left join pagado p on p.venta_id = v.id
left join plan   pl on pl.venta_id = v.id
-- La próxima cuota a pagar: la primera cuyo monto ACUMULADO supera lo que ya
-- se abonó. Ejemplo: cuotas de 10/10/10 y $15.000 pagados → la cuota 1 está
-- cubierta (acumulado 10.000 ≤ 15.000) y la próxima es la 2 (acumulado
-- 20.000 > 15.000). Así se deduce en qué cuota va sin tener que preguntarle
-- a nadie a qué cuota corresponde cada abono.
left join lateral (
  select t.numero, t.vence, t.monto
    from (
      select cu.numero, cu.vence, cu.monto,
             sum(cu.monto) over (order by cu.numero) as acumulado
        from public.cuotas cu
       where cu.venta_id = v.id
    ) t
   where t.acumulado > coalesce(p.pagado, 0)
   order by t.numero
   limit 1
) prox on true
where v.forma_pago = 'cuotas'
  and v.total > coalesce(p.pagado, 0)
order by vencido desc, prox.vence nulls last;


-- ---------------------------------------------------------------------------
-- Una fila por clienta que debe
-- ---------------------------------------------------------------------------
create or replace view public.v_clientes_deuda
with (security_invoker = true) as
select
  d.cliente_id,
  d.cliente,
  d.telefono,
  d.es_confianza,
  count(*)::int        as ventas_abiertas,
  sum(d.saldo)::int    as deuda_total,
  sum(d.vencido)::int  as vencido_total,
  min(d.proximo_vence) as proximo_vence,
  max(d.dias_de_atraso) as peor_atraso,
  cl.limite_credito,
  -- Cuánto le queda de cupo. NULL si no tiene tope definido.
  case when cl.limite_credito is null then null
       else cl.limite_credito - sum(d.saldo)::int
  end as cupo_disponible
from public.v_deudas d
left join public.clientes cl on cl.id = d.cliente_id
group by d.cliente_id, d.cliente, d.telefono, d.es_confianza, cl.limite_credito
order by vencido_total desc, deuda_total desc;
