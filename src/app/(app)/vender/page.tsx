import { createClient } from "@/lib/supabase/server";
import RegistrarVenta from "./RegistrarVenta";
import type { Cliente, Planta, Promocion } from "@/lib/types";

export const metadata = { title: "Vender · Plantas de Camila" };

export default async function PaginaVender() {
  const supabase = await createClient();

  // Las tres listas en paralelo: en un celular con señal regular, encadenarlas
  // suma medio segundo de espera por nada.
  const [plantas, promociones, clientes] = await Promise.all([
    supabase
      .from("plantas")
      .select("*")
      .eq("activa", true)
      .order("categoria")
      .order("nombre"),
    supabase.from("promociones").select("*").eq("activa", true).order("nombre"),
    supabase.from("clientes").select("id,nombre,telefono").order("nombre").limit(300),
  ]);

  if (plantas.error) {
    return (
      <div className="p-6">
        <div className="tarjeta p-5">
          <h1 className="font-semibold">No se pudo cargar el catálogo</h1>
          <p className="mt-2 text-sm text-ink-2">
            Revisá que las migraciones de <code>supabase/migrations</code> estén
            aplicadas y que las variables de entorno sean correctas.
          </p>
          <p className="mt-3 text-xs text-ink-3">{plantas.error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <RegistrarVenta
      plantas={(plantas.data ?? []) as Planta[]}
      promociones={(promociones.data ?? []) as Promocion[]}
      clientes={(clientes.data ?? []) as Pick<Cliente, "id" | "nombre" | "telefono">[]}
    />
  );
}
