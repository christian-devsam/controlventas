import { createClient } from "@/lib/supabase/server";
import type { Planta } from "@/lib/types";
import Catalogo from "./Catalogo";

export const metadata = { title: "Plantas · Plantas de Camila" };

export default async function PaginaPlantas() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plantas")
    .select("*")
    .order("activa", { ascending: false })
    .order("categoria")
    .order("nombre");

  if (error) {
    return (
      <div className="p-4">
        <div className="tarjeta p-5 text-sm">
          <p className="font-semibold">No se pudo cargar el catálogo</p>
          <p className="mt-2 text-ink-3">{error.message}</p>
        </div>
      </div>
    );
  }

  return <Catalogo plantas={(data ?? []) as Planta[]} />;
}
