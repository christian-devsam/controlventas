import "server-only";
import { createClient as crearClienteSupabase } from "@supabase/supabase-js";

/**
 * Cliente de Supabase. Sólo servidor.
 *
 * El `import "server-only"` de arriba no es decorativo: si algún día alguien
 * importa este archivo desde un componente con `"use client"`, la build FALLA
 * en vez de mandar la llave `service_role` al navegador. Es la diferencia
 * entre un error de compilación y filtrar la llave maestra de la base.
 *
 * `service_role` pasa por encima de RLS, y por eso la única forma de llegar
 * acá es a través de un Server Component o una Server Action — y a esos sólo
 * se llega con la cookie de sesión válida, que revisa `proxy.ts`.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !llave) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.",
    );
  }

  return crearClienteSupabase(url, llave, {
    auth: {
      // No hay usuarios: no hay sesión que persistir ni token que refrescar.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
