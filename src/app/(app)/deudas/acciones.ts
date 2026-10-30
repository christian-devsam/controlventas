"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MetodoPago } from "@/lib/types";

export type ResultadoPago =
  | { ok: true; pagado: number; saldo: number }
  | { ok: false; error: string };

/**
 * Registra un abono contra una venta a crédito.
 *
 * El abono va contra la VENTA, no contra una cuota puntual. En la vida real
 * nadie dice "esto es para la cuota 2": dice "te abono $5.000". Qué cuota
 * queda cubierta lo deduce la vista `v_deudas`.
 */
export async function registrarPago(datos: {
  venta_id: string;
  monto: number;
  metodo_pago: MetodoPago;
  nota?: string | null;
}): Promise<ResultadoPago> {
  if (!Number.isFinite(datos.monto) || datos.monto <= 0) {
    return { ok: false, error: "El abono tiene que ser mayor que cero." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("registrar_pago", {
      p_venta_id: datos.venta_id,
      p_monto: Math.round(datos.monto),
      p_metodo_pago: datos.metodo_pago,
      p_nota: datos.nota ?? null,
    })
    .single<{ pagado: number; saldo: number }>();

  if (error) {
    console.error("registrar_pago falló:", error);
    return {
      ok: false,
      // Este caso es esperable (se escribió de más), así que se muestra tal
      // cual: el mensaje de Postgres ya dice cuánto queda.
      error: error.message.includes("supera el saldo")
        ? "Ese monto es mayor que lo que debe."
        : "No se pudo registrar el abono.",
    };
  }

  revalidatePath("/deudas");
  revalidatePath("/dashboard");
  revalidatePath("/ventas");

  return { ok: true, pagado: data.pagado, saldo: data.saldo };
}
