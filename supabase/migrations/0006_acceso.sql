-- ============================================================================
--  Plantas de Camila — Acceso por PIN
--  Ejecutar DESPUÉS de 0005_panel.sql
-- ============================================================================
--
--  CAMBIO DE MODELO DE SEGURIDAD
--
--  Antes: el navegador tenía una sesión de Supabase y hablaba directo con la
--  base; las políticas RLS decidían qué podía ver.
--
--  Ahora: el navegador NO tiene ninguna credencial de base de datos. Todo pasa
--  por el servidor de Next (Server Components y Server Actions), que usa la
--  llave `service_role`, y lo único que decide si alguien entra es una cookie
--  firmada que se obtiene escribiendo el PIN.
--
--  Esto es más seguro que antes, no menos: la `anon key` ya no viaja al
--  navegador, así que aunque alguien inspeccione el bundle no encuentra nada
--  con qué consultar la base.
--
--  Por eso se eliminan las políticas que daban acceso a `authenticated`: ya no
--  existen usuarios autenticados. RLS queda ACTIVO y sin políticas, que es el
--  estado más restrictivo posible — `anon` y `authenticated` no pueden leer ni
--  una fila. `service_role` pasa por encima de RLS por diseño, y es la única
--  llave que usa el servidor.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'plantas', 'clientes', 'promociones', 'ventas', 'venta_items', 'movimientos_stock'
  ]
  loop
    execute format('drop policy if exists "acceso_autenticado" on public.%I', t);
    -- RLS sigue activo a propósito. Sin políticas = nadie entra salvo
    -- service_role. Es la red de seguridad por si mañana alguien expone la
    -- anon key sin querer.
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Las funciones ya no las llama nadie desde el navegador.
revoke execute on function public.registrar_venta(jsonb, text, text, uuid, text, text, text) from authenticated;
revoke execute on function public.anular_venta(uuid) from authenticated;
revoke execute on function public.mover_stock(uuid, int, text, text) from authenticated;
revoke execute on function public.recalcular_stock() from authenticated;
revoke execute on function public.panel_kpis(int) from authenticated;
revoke execute on function public.panel_serie_diaria(int) from authenticated;
revoke execute on function public.panel_top_plantas(int, int) from authenticated;
revoke execute on function public.panel_categorias(int) from authenticated;
revoke execute on function public.panel_mapa_horario(int) from authenticated;
revoke execute on function public.panel_promociones(int) from authenticated;


-- ---------------------------------------------------------------------------
-- Freno de intentos
-- ---------------------------------------------------------------------------
--  Un PIN de 4 dígitos son 10.000 combinaciones. Sin freno, un script las
--  prueba todas en minutos y el PIN no sirve para nada.
--
--  El contador vive en Postgres y no en memoria del servidor a propósito: en
--  Vercel cada request puede tocar una instancia distinta, así que un contador
--  en memoria se reiniciaría solo y no frenaría nada.
create table if not exists public.intentos_acceso (
  id        bigint generated always as identity primary key,
  ip        text        not null,
  exitoso   boolean     not null,
  creado_en timestamptz not null default now()
);

create index if not exists intentos_acceso_idx
  on public.intentos_acceso (ip, creado_en desc);

alter table public.intentos_acceso enable row level security;


-- ---------------------------------------------------------------------------
-- Registrar un intento y devolver si la IP quedó bloqueada
-- ---------------------------------------------------------------------------
--  Devuelve cuántos intentos fallidos lleva esa IP en los últimos 15 minutos.
--  Un intento exitoso limpia el historial, así que equivocarse y después
--  acertar no deja a nadie bloqueado.
create or replace function public.registrar_intento(
  p_ip      text,
  p_exitoso boolean
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fallidos int;
begin
  insert into public.intentos_acceso (ip, exitoso) values (p_ip, p_exitoso);

  if p_exitoso then
    delete from public.intentos_acceso where ip = p_ip;
    return 0;
  end if;

  select count(*)::int into v_fallidos
    from public.intentos_acceso
   where ip = p_ip
     and not exitoso
     and creado_en > now() - interval '15 minutes';

  -- Limpieza oportunista: sin esto la tabla crece para siempre.
  delete from public.intentos_acceso where creado_en < now() - interval '1 day';

  return v_fallidos;
end;
$$;
