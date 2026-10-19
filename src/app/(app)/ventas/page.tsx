import { createClient } from "@/lib/supabase/server";
import { clp, fechaCorta } from "@/lib/format";
import type { VentaDetalle } from "@/lib/types";
import FilaVenta from "./FilaVenta";

export const metadata = { title: "Ventas · Plantas de Camila" };

/* Sin esto Next prerenderiza la página en el build y el historial queda
   congelado. Ver la nota larga en vender/page.tsx. */
export const dynamic = "force-dynamic";

/** Agrupa las ventas por día (en hora de Santiago) para mostrar subtotales. */
function porDia(ventas: VentaDetalle[]) {
  const grupos = new Map<string, { ventas: VentaDetalle[]; total: number }>();

  for (const v of ventas) {
    // `en-CA` da formato ISO (2026-10-19), que ordena bien como texto.
    const dia = new Date(v.fecha).toLocaleDateString("en-CA", {
      timeZone: "America/Santiago",
    });
    const g = grupos.get(dia) ?? { ventas: [], total: 0 };
    g.ventas.push(v);
    g.total += v.total;
    grupos.set(dia, g);
  }

  return [...grupos.entries()];
}

export default async function PaginaVentas() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ventas")
    .select("*, venta_items(*), clientes(id,nombre)")
    .order("fecha", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="p-4">
        <div className="tarjeta p-5 text-sm">
          <p className="font-semibold">No se pudieron cargar las ventas</p>
          <p className="mt-2 text-ink-3">{error.message}</p>
        </div>
      </div>
    );
  }

  const ventas = (data ?? []) as unknown as VentaDetalle[];
  const grupos = porDia(ventas);

  return (
    <div className="px-4 pt-4">
      <h1 className="text-xl font-semibold tracking-tight">Últimas ventas</h1>
      <p className="mt-1 text-sm text-ink-2">
        Las 100 más recientes. Tocá una para ver el detalle o anularla.
      </p>

      {grupos.length === 0 ? (
        <div className="tarjeta mt-4 p-8 text-center">
          <p className="text-3xl" aria-hidden="true">
            🌱
          </p>
          <p className="mt-2 text-sm font-medium">Todavía no hay ventas</p>
          <p className="mt-1 text-sm text-ink-3">
            Registrá la primera desde la pestaña Vender.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {grupos.map(([dia, g]) => (
            <section key={dia}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">{fechaCorta(dia)}</h2>
                <p className="cifras text-sm font-semibold text-ink-2">
                  {clp(g.total)}{" "}
                  <span className="font-normal text-ink-3">
                    · {g.ventas.length} {g.ventas.length === 1 ? "venta" : "ventas"}
                  </span>
                </p>
              </div>
              <ul className="space-y-2">
                {g.ventas.map((v) => (
                  <li key={v.id}>
                    <FilaVenta venta={v} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
