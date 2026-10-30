import { clp, numero, variacion } from "@/lib/format";
import type { FilaKpis } from "./tipos";

/**
 * Encabezado de números. No es un gráfico a propósito: cuatro valores
 * puntuales se leen mejor como texto grande que como cuatro barras.
 *
 * La cifra protagonista (ingresos del período) va en tamaño héroe, una sola
 * por pantalla, en la misma tipografía del resto — sin serif ni display.
 */
export default function FilaKPIs({ kpis, dias }: { kpis: FilaKpis; dias: number }) {
  const delta = variacion(kpis.ingresos, kpis.ingresos_previo);

  return (
    <section className="mt-4" aria-label={`Resumen de los últimos ${dias} días`}>
      <div className="tarjeta p-5">
        <p className="text-sm text-ink-2">Vendido · últimos {dias} días</p>

        {/* Cifra héroe: sin `tabular-nums`, que a este tamaño deja los dígitos
            flotando separados. */}
        <p className="mt-1 text-[2.75rem] font-semibold leading-none tracking-tight">
          {clp(kpis.ingresos)}
        </p>

        {delta !== null ? (
          <p className="mt-2 text-sm">
            <span
              className={`font-semibold ${delta >= 0 ? "text-ok-texto" : "text-critico-texto"}`}
            >
              {/* Flecha + signo + texto: la dirección nunca depende del color
                  solo, así se lee igual con daltonismo. */}
              {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
            </span>{" "}
            <span className="text-ink-2">
              vs. los {dias} días anteriores ({clp(kpis.ingresos_previo)})
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-3">
            Sin datos del período anterior para comparar.
          </p>
        )}

        {/* VENDIDO ≠ COBRADO. Con ventas en cuotas los dos números se separan,
            y mostrar sólo el de arriba haría creer que hay plata en la caja
            que todavía no llegó. Esta línea es la que evita ese error. */}
        {kpis.por_cobrar > 0 && (
          <dl className="mt-4 flex gap-5 border-t border-linea pt-3 text-sm">
            <div>
              <dt className="text-xs text-ink-2">Entró a la caja</dt>
              <dd className="cifras mt-0.5 font-semibold">{clp(kpis.cobrado)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-2">Te deben</dt>
              <dd
                className={`cifras mt-0.5 font-semibold ${
                  kpis.vencido > 0 ? "text-critico-texto" : ""
                }`}
              >
                {clp(kpis.por_cobrar)}
                {kpis.vencido > 0 && (
                  <span className="ml-1 text-xs font-normal">
                    ({clp(kpis.vencido)} vencido)
                  </span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2">
        <Tile
          etiqueta="Utilidad"
          valor={clp(kpis.utilidad)}
          nota={
            kpis.unidades_sin_costo > 0
              ? `parcial · ${kpis.unidades_sin_costo} sin costo`
              : kpis.ingresos > 0
                ? `${Math.round((kpis.utilidad / kpis.ingresos) * 100)}% de margen`
                : "—"
          }
        />
        <Tile etiqueta="Hoy" valor={clp(kpis.ingresos_hoy)} nota={`${kpis.ventas_hoy} ventas`} />
        <Tile
          etiqueta="Ticket promedio"
          valor={clp(kpis.ticket_promedio)}
          nota={`${numero(kpis.ventas)} ventas`}
        />
        <Tile
          etiqueta="Plantas vendidas"
          valor={numero(kpis.unidades)}
          nota={`en ${dias} días`}
        />
      </dl>
    </section>
  );
}

function Tile({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
}) {
  return (
    <div className="tarjeta p-3.5">
      <dt className="text-xs text-ink-2">{etiqueta}</dt>
      <dd className="mt-1 text-xl font-semibold leading-tight">{valor}</dd>
      <dd className="mt-0.5 text-[11px] text-ink-3">{nota}</dd>
    </div>
  );
}
