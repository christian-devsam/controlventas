import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, sesionValida } from "@/lib/sesion";

/**
 * Proxy de Next (lo que hasta Next 15 se llamaba `middleware`).
 *
 * Un solo trabajo: si no hay una cookie de sesión firmada y vigente, mandar a
 * `/entrar`. No consulta la base de datos — verifica una firma HMAC, que son
 * microsegundos y ningún viaje de red.
 *
 * El guardia vive acá, en el borde, y no en cada página: así no hay forma de
 * agregar una ruta nueva y olvidarse de protegerla.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const entrando = pathname === "/entrar";
  const autorizada = await sesionValida(request.cookies.get(COOKIE_SESION)?.value);

  if (!autorizada && !entrando) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (autorizada && entrando) {
    const url = request.nextUrl.clone();
    url.pathname = "/vender";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    // Todo menos estáticos, imágenes y el logo.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
