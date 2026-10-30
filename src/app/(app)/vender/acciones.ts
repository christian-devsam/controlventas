"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Canal, MetodoPago } from "@/lib/types";

export type ItemParaGuardar = {
  planta_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_lista: number;
  promocion_id: string | null;
};

export type ResultadoVenta =
  | { ok: true; folio: number; total: number; saldo: number }
  | { ok: false; error: string };

function revalidarTodo() {
  revalidatePath("/vender");
  revalidatePath("/ventas");
  revalidatePath("/plantas");
  revalidatePath("/dashboard");
  revalidatePath("/deudas");
}

/**
 * Guarda una venta llamando a `registrar_venta` de Postgres.
 *
 * Ni los totales ni los costos se mandan desde acá: los totales los derivan
 * los triggers desde las líneas, y el costo lo lee la función desde la planta.
 * Así no hay forma de que un error de la app escriba una utilidad falsa en el
 * histórico.
 */
export async function registrarVenta(datos: {
  items: ItemParaGuardar[];
  canal: Canal;
  metodo_pago: MetodoPago;
  cliente_id?: string | null;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  notas?: string | null;
  /** 0 o 1 = al contado. */
  cuotas?: number;
  abono_inicial?: number;
  /** `2026-11-30`. Si falta, la base usa dentro de un mes. */
  primer_vence?: string | null;
}): Promise<ResultadoVenta> {
  if (!datos.items.length) {
    return { ok: false, error: "No hay ninguna planta en la venta." };
  }

  const cuotas = datos.cuotas ?? 0;

  if (cuotas > 1 && !datos.cliente_id && !datos.cliente_nombre?.trim()) {
    return {
      ok: false,
      error: "Una venta en cuotas necesita una clienta. Elegí una o escribí el nombre.",
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("registrar_venta", {
      p_items: datos.items,
      p_canal: datos.canal,
      p_metodo_pago: datos.metodo_pago,
      p_cliente_id: datos.cliente_id ?? null,
      p_cliente_nombre: datos.cliente_nombre ?? null,
      p_cliente_telefono: datos.cliente_telefono ?? null,
      p_notas: datos.notas ?? null,
      p_cuotas: cuotas,
      p_abono_inicial: datos.abono_inicial ?? 0,
      p_primer_vence: datos.primer_vence ?? null,
    })
    .single<{ folio: number; total: number; saldo: number }>();

  if (error) {
    console.error("registrar_venta falló:", error);
    return {
      ok: false,
      // El mensaje de Postgres no le dice nada a quien está atendiendo, salvo
      // las validaciones que escribimos nosotros, que sí están en castellano.
      error: error.message.includes("cuotas necesita")
        ? "Una venta en cuotas necesita una clienta registrada."
        : "No se pudo guardar la venta. Revisá la conexión e intentá otra vez.",
    };
  }

  revalidarTodo();
  return { ok: true, folio: data.folio, total: data.total, saldo: data.saldo };
}

export async function anularVenta(ventaId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_venta", { p_venta_id: ventaId });

  if (error) {
    console.error("anular_venta falló:", error);
    return { ok: false, error: "No se pudo anular la venta." };
  }

  revalidarTodo();
  return { ok: true };
}

/**
 * Marca a una clienta como de confianza (o se lo quita).
 *
 * Es un acto deliberado y aparte de la venta: vender en cuotas es prestar
 * plata, y esa decisión no debería colarse como efecto secundario de apretar
 * "cobrar".
 */
export async function marcarConfianza(
  clienteId: string,
  confianza: boolean,
  limite?: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_confianza", {
    p_cliente_id: clienteId,
    p_confianza: confianza,
    p_limite: limite ?? null,
  });

  if (error) {
    console.error("marcar_confianza falló:", error);
    return { ok: false, error: "No se pudo actualizar la clienta." };
  }

  revalidarTodo();
  return { ok: true };
}
