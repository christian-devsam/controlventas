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
  | { ok: true; folio: number; total: number }
  | { ok: false; error: string };

/**
 * Guarda una venta llamando a la función `registrar_venta` de Postgres.
 *
 * Toda la validación de montos vive en la base (ver 0004_funciones.sql): los
 * totales los derivan los triggers desde las líneas, así que acá no se manda
 * ningún total y no hay forma de guardar una venta descuadrada.
 */
export async function registrarVenta(datos: {
  items: ItemParaGuardar[];
  canal: Canal;
  metodo_pago: MetodoPago;
  cliente_id?: string | null;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  notas?: string | null;
}): Promise<ResultadoVenta> {
  if (!datos.items.length) {
    return { ok: false, error: "No hay ninguna planta en la venta." };
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
    })
    .single<{ folio: number; total: number }>();

  if (error) {
    // El mensaje crudo de Postgres no le dice nada a quien está atendiendo.
    console.error("registrar_venta falló:", error);
    return {
      ok: false,
      error: "No se pudo guardar la venta. Revisá la conexión e intentá otra vez.",
    };
  }

  // El stock y los números del dashboard cambiaron.
  revalidatePath("/vender");
  revalidatePath("/ventas");
  revalidatePath("/plantas");
  revalidatePath("/dashboard");

  return { ok: true, folio: data.folio, total: data.total };
}

export async function anularVenta(ventaId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_venta", { p_venta_id: ventaId });

  if (error) {
    console.error("anular_venta falló:", error);
    return { ok: false, error: "No se pudo anular la venta." };
  }

  revalidatePath("/ventas");
  revalidatePath("/plantas");
  revalidatePath("/dashboard");
  return { ok: true };
}
