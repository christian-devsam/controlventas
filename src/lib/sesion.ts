/**
 * Sesión por PIN, sin base de datos de usuarios.
 *
 * La cookie no guarda "está logueada: sí". Guarda una fecha de vencimiento
 * FIRMADA con HMAC-SHA256 usando un secreto que sólo existe en el servidor.
 * Sin ese secreto no se puede fabricar una cookie válida, así que editarla a
 * mano desde el navegador no sirve de nada.
 *
 * Se usa Web Crypto (`crypto.subtle`) y no el módulo `crypto` de Node porque
 * esto corre también en `proxy.ts`, que puede ejecutarse en el runtime Edge.
 */

export const COOKIE_SESION = "pdc_sesion";

/** Un año: la idea es escribir el PIN una vez por teléfono y nunca más. */
const DURACION_MS = 365 * 24 * 60 * 60 * 1000;

const codificador = new TextEncoder();

function secreto(): string {
  const s = process.env.SESION_SECRETO;
  if (!s || s.length < 32) {
    throw new Error(
      "Falta SESION_SECRETO (mínimo 32 caracteres). Generá uno con: openssl rand -base64 32",
    );
  }
  return s;
}

async function clave(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    codificador.encode(secreto()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function aBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function firmar(mensaje: string): Promise<string> {
  const firma = await crypto.subtle.sign("HMAC", await clave(), codificador.encode(mensaje));
  return aBase64Url(firma);
}

/**
 * Comparación en tiempo constante.
 *
 * Un `===` corta apenas encuentra el primer carácter distinto, y ese tiempo
 * distinto es medible: permite adivinar la firma carácter por carácter. Acá
 * siempre se recorre todo.
 */
function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferencia === 0;
}

/** Arma el valor de la cookie: `<vence>.<firma>`. */
export async function crearValorSesion(): Promise<string> {
  const vence = String(Date.now() + DURACION_MS);
  return `${vence}.${await firmar(vence)}`;
}

/** `true` sólo si la firma es válida y la fecha no venció. */
export async function sesionValida(valor: string | undefined): Promise<boolean> {
  if (!valor) return false;

  const corte = valor.lastIndexOf(".");
  if (corte <= 0) return false;

  const vence = valor.slice(0, corte);
  const firmaRecibida = valor.slice(corte + 1);

  if (!/^\d+$/.test(vence)) return false;
  if (Number(vence) < Date.now()) return false;

  return igualesEnTiempoConstante(firmaRecibida, await firmar(vence));
}

/** Opciones de la cookie. `httpOnly` para que el JavaScript de la página no pueda leerla. */
export const OPCIONES_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: Math.floor(DURACION_MS / 1000),
};

/** Compara el PIN escrito contra el de las variables de entorno. */
export function pinCorrecto(escrito: string): boolean {
  const esperado = process.env.APP_PIN;
  if (!esperado) {
    throw new Error("Falta APP_PIN en las variables de entorno.");
  }
  return igualesEnTiempoConstante(escrito.trim(), esperado.trim());
}
