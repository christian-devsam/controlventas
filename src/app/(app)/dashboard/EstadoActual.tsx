import { clp } from "@/lib/format";
import type { ClienteTop, StockAlerta } from "@/lib/types";

/**
 * Dos tarjetas de "estado de ahora", separadas del resto del panel.
 *
 * Van en su propia sección con rótulo porque NO dependen del selector de
 * período. Mezcladas arriba darían a entender que cambiar a 7 días también
 * las cambia, y no es así: el stock que hay es el que hay.
 */
export default function EstadoActual({
  reponer,
  clientas,
}: {
  reponer: StockAlerta[];
  clientas: ClienteTop[];
}) {
  if (!reponer.length && !clientas.length) return null;

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold">Ahora mismo</h2>
      <p className="mt-0.5 text-xs text-ink-3">
        Esto no cambia con el período de arriba: es el estado actual.
      </p>

      <div className="mt-3 space-y-4">
        {reponer.length > 0 && (
          <div className="tarjeta p-4">
            <h3 className="text-sm font-semibold">
              <span aria-hidden="true">📦 </span>Hay que reponer
            </h3>
            <p className="mt-0.5 text-xs text-ink-3">
              Bajo el mínimo que definiste para cada planta
            </p>

            <ul className="mt-3 divide-y divide-linea">
              {reponer.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{p.nombre}</p>
                    <p className="cifras mt-0.5 text-[11px] text-ink-3">
                      {p.vendidas_ultimos_30d > 0
                        ? `${p.vendidas_ultimos_30d} vendidas en 30 días`
                        : "sin ventas en 30 días"}
                      {/* El dato accionable: no "queda poco" sino "te alcanza
                          para N días a este ritmo de venta". */}
                      {p.dias_de_stock_restante !== null &&
                        ` · alcanza ~${p.dias_de_stock_restante} días`}
                    </p>
                  </div>
                  <span
                    className={`cifras shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
                      p.stock <= 0
                        ? "bg-critico/15 text-critico-texto"
                        : "bg-grave/15 text-ink"
                    }`}
                  >
                    {p.stock <= 0 ? "agotada" : `quedan ${p.stock}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {clientas.length > 0 && (
          <div className="tarjeta p-4">
            <h3 className="text-sm font-semibold">
              <span aria-hidden="true">💚 </span>Clientas que vuelven
            </h3>
            <p className="mt-0.5 text-xs text-ink-3">
              Las que más gastaron. Conseguir que una vuelva cuesta mucho menos
              que conseguir una nueva.
            </p>

            <ul className="mt-3 divide-y divide-linea">
              {clientas.map((c) => (
                <li key={c.cliente_id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{c.nombre}</p>
                    <p className="cifras mt-0.5 text-[11px] text-ink-3">
                      {c.compras} {c.compras === 1 ? "compra" : "compras"} · ticket{" "}
                      {clp(c.ticket_promedio)}
                      {c.dias_sin_comprar >= 30 &&
                        ` · hace ${c.dias_sin_comprar} días que no viene`}
                    </p>
                  </div>
                  <span className="cifras shrink-0 text-xs font-semibold">
                    {clp(c.gasto_total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
