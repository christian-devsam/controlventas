import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para componentes que corren en el navegador.
 *
 * Usa la `anon key`, que es pública a propósito: la protección real está en las
 * políticas RLS de Postgres (ver supabase/migrations/0001_esquema.sql). Sin una
 * sesión válida, esta llave no devuelve ni una fila.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
