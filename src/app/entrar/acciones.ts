"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  COOKIE_SESION,
  OPCIONES_COOKIE,
  crearValorSesion,
  pinCorrecto,
} from "@/lib/sesion";

const MAX_INTENTOS = 5;

export type ResultadoAcceso =
  | { ok: true }
  | { ok: false; error: string; bloqueada?: boolean };

/**
 * Verifica el PIN y, si está bien, deja la cookie de sesión por un año.
 *
 * El PIN nunca viaja al navegador ni se compara en el cliente: vive en
 * `APP_PIN`, una variable de entorno sin prefijo `NEXT_PUBLIC_`, así que Next
 * no la incluye en el bundle.
 */
export async function verificarPin(pin: string): Promise<ResultadoAcceso> {
  const ip = await ipDelCliente();
  const supabase = await createClient();

  // El bloqueo se evalúa ANTES de mirar el PIN. Si se comprobara después, a
  // quien está probando las 10.000 combinaciones le bastaría con acertar en
  // algún intento para entrar, y el freno no habría servido de nada.
  const { count: fallidosPrevios } = await supabase
    .from("intentos_acceso")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("exitoso", false)
    .gt("creado_en", new Date(Date.now() - 15 * 60 * 1000).toISOString());

  if ((fallidosPrevios ?? 0) >= MAX_INTENTOS) {
    return {
      ok: false,
      bloqueada: true,
      error: "Demasiados intentos. Esperá 15 minutos.",
    };
  }

  const acertado = pinCorrecto(pin);

  // `registrar_intento` guarda el intento y devuelve cuántos fallos lleva la
  // IP. El contador vive en Postgres porque en Vercel cada request puede caer
  // en una instancia distinta: uno en memoria se reiniciaría solo.
  const { data: fallidos, error } = await supabase.rpc("registrar_intento", {
    p_ip: ip,
    p_exitoso: acertado,
  });

  if (error) {
    console.error("registrar_intento falló:", error);
    return { ok: false, error: "No se pudo verificar. Intentá de nuevo." };
  }

  if (!acertado) {
    const restantes = MAX_INTENTOS - (fallidos ?? 0);
    if (restantes <= 0) {
      return {
        ok: false,
        bloqueada: true,
        error: "Demasiados intentos. Esperá 15 minutos.",
      };
    }
    return {
      ok: false,
      error:
        restantes === 1
          ? "PIN incorrecto. Queda 1 intento."
          : `PIN incorrecto. Quedan ${restantes} intentos.`,
    };
  }

  const almacen = await cookies();
  almacen.set(COOKIE_SESION, await crearValorSesion(), OPCIONES_COOKIE);

  return { ok: true };
}

export async function salir() {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);
}

/**
 * IP del cliente según las cabeceras que pone Vercel.
 *
 * En local no hay ninguna, y ahí todo cae en el mismo cubo "local" — que para
 * el desarrollo está bien.
 */
async function ipDelCliente(): Promise<string> {
  const h = await headers();
  const reenviada = h.get("x-forwarded-for");
  if (reenviada) return reenviada.split(",")[0].trim();
  return h.get("x-real-ip") ?? "local";
}
