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
        <p className="text-sm text-ink-2">Ingresos · últimos {dias} días</p>

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
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2">
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
        <Tile
          etiqueta="Descuentos dados"
          valor={clp(kpis.descuentos)}
          nota={
            kpis.ingresos + kpis.descuentos > 0
              ? `${Math.round((kpis.descuentos / (kpis.ingresos + kpis.descuentos)) * 100)}% del precio de lista`
              : "—"
          }
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
