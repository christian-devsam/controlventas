"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Resultado = { ok: true } | { ok: false; error: string };

function revalidarTodo() {
  revalidatePath("/plantas");
  revalidatePath("/vender");
  revalidatePath("/dashboard");
}

export async function guardarPlanta(datos: {
  id?: string;
  nombre: string;
  categoria: string;
  precio_base: number;
  costo: number | null;
  stock_minimo: number;
  emoji: string | null;
  stock_inicial?: number;
}): Promise<Resultado> {
  const nombre = datos.nombre.trim();
  if (!nombre) return { ok: false, error: "Falta el nombre." };
  if (!Number.isFinite(datos.precio_base) || datos.precio_base < 0) {
    return { ok: false, error: "El precio no es válido." };
  }

  const supabase = await createClient();

  const campos = {
    nombre,
    categoria: datos.categoria.trim() || "Otras",
    precio_base: Math.round(datos.precio_base),
    costo: datos.costo === null ? null : Math.round(datos.costo),
    stock_minimo: Math.max(0, Math.round(datos.stock_minimo)),
    emoji: datos.emoji?.trim() || null,
  };

  if (datos.id) {
    const { error } = await supabase.from("plantas").update(campos).eq("id", datos.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("plantas")
      .insert(campos)
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    // El stock inicial entra como movimiento, nunca escribiendo la columna
    // directamente: así el inventario tiene historial desde el primer día.
    const inicial = Math.round(datos.stock_inicial ?? 0);
    if (inicial > 0) {
      const { error: errorStock } = await supabase.rpc("mover_stock", {
        p_planta_id: data.id,
        p_cantidad: inicial,
        p_tipo: "ingreso",
        p_nota: "Stock inicial",
      });
      if (errorStock) return { ok: false, error: errorStock.message };
    }
  }

  revalidarTodo();
  return { ok: true };
}

/** Reposición, ajuste de conteo o merma. Pasa por la función de Postgres. */
export async function moverStock(datos: {
  planta_id: string;
  cantidad: number;
  tipo: "ingreso" | "ajuste" | "merma";
  nota?: string;
}): Promise<Resultado> {
  const cantidad = Math.round(datos.cantidad);
  if (!cantidad) return { ok: false, error: "La cantidad no puede ser cero." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mover_stock", {
    p_planta_id: datos.planta_id,
    // Mermas y salidas se guardan en negativo; el signo lo pone el servidor,
    // no el formulario, para que no dependa de que el cliente lo mande bien.
    p_cantidad: datos.tipo === "merma" ? -Math.abs(cantidad) : cantidad,
    p_tipo: datos.tipo,
    p_nota: datos.nota ?? null,
  });

  if (error) return { ok: false, error: error.message };

  revalidarTodo();
  return { ok: true };
}

export async function cambiarActiva(id: string, activa: boolean): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("plantas").update({ activa }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidarTodo();
  return { ok: true };
}
