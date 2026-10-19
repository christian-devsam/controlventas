import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Destino del enlace del correo.
 *
 * Soporta las dos formas en que Supabase puede devolver al usuario:
 *  - `?code=...`       → flujo PKCE (el que usa @supabase/ssr por defecto)
 *  - `?token_hash=...` → enlace con hash, si se personaliza la plantilla
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type");
  const volver = searchParams.get("volver") ?? "/vender";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${volver}`);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tipo as "email" | "magiclink" | "recovery",
    });
    if (!error) return NextResponse.redirect(`${origin}${volver}`);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/login?error=enlace_invalido`);
}
