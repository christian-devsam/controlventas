"use client";

import { clp } from "@/lib/format";
import TarjetaGrafico from "./TarjetaGrafico";
import type { FilaCategoria } from "./tipos";

/** Los ocho slots de la paleta, en el orden validado (ver globals.css). */
const SLOTS = [
  "var(--s1)",
  "var(--s2)",
  "var(--s3)",
  "var(--s4)",
  "var(--s5)",
  "var(--s6)",
  "var(--s7)",
  "var(--s8)",
];

const COLOR_OTRAS = "var(--ink-3)";

/**
 * En qué rubro está la plata.
 *
 * Barra apilada y no torta: para parte-del-total una barra se lee mejor,
 * ocupa menos alto en un teléfono, y los nombres caben al lado en vez de
 * necesitar líneas guía saliendo de un círculo.
 *
 * Está hecha con HTML plano a propósito. Recharts no puede dejar un hueco real
 * de 2px entre segmentos apilados (habría que simularlo con un borde, que es
 * justo lo que no se debe hacer), y acá el hueco es un `gap` de CSS de verdad.
 */
export default function GraficoCategorias({
  datos,
  ordenCategorias,
}: {
  datos: FilaCategoria[];
  ordenCategorias: string[];
}) {
  const total = datos.reduce((s, d) => s + d.ingresos, 0);
  if (total === 0) return null;

  /* El color sale de la posición alfabética de la categoría en el catálogo
     COMPLETO, no de su lugar en el ranking del período. Así "Suculentas" es
     siempre el mismo color: cambiar de 30 a 7 días reordena las barras pero no
     repinta nada. Un color que sigue al ranking engaña a quien ya se aprendió
     la correspondencia.

     Más de 8 categorías: las que se pasan van a "Otras" en gris. Nunca se
     genera un noveno color — bajo daltonismo sería indistinguible de alguno
     de los ocho. */
  const colorDe = (categoria: string) => {
    const i = ordenCategorias.indexOf(categoria);
    return i >= 0 && i < SLOTS.length ? SLOTS[i] : COLOR_OTRAS;
  };

  const segmentos = [...datos]
    .sort((a, b) => b.ingresos - a.ingresos)
    .map((d) => ({
      ...d,
      pct: (d.ingresos / total) * 100,
      color: colorDe(d.categoria),
    }));

  const lider = segmentos[0];

  return (
    <TarjetaGrafico
      titulo="Ingresos por categoría"
      bajada={`${lider.categoria} es ${Math.round(lider.pct)}% de los ingresos`}
      alto={56 + segmentos.length * 28}
      tabla={<TablaCategorias segmentos={segmentos} total={total} />}
    >
      {/* --- La barra --------------------------------------------------- */}
      <div
        className="flex h-10 w-full gap-0.5 overflow-hidden rounded-lg"
        role="img"
        aria-label={segmentos
          .map((s) => `${s.categoria}: ${Math.round(s.pct)}%`)
          .join(", ")}
      >
        {segmentos.map((s) => (
          <div
            key={s.categoria}
            className="flex items-center justify-center first:rounded-l-lg last:rounded-r-lg"
            style={{ width: `${s.pct}%`, background: s.color }}
          >
            {/* La etiqueta va DENTRO sólo si cabe con aire a los dos lados.
                Si no cabe, no se recorta ni se encima: se cae a la leyenda y a
                la tabla, donde el valor sigue estando. */}
            {s.pct >= 14 && (
              <span
                className="cifras px-1 text-[11px] font-bold"
                /* Blanco o tinta según la luminancia del relleno, para que
                   siempre contraste contra su propio segmento. */
                style={{ color: textoSobre(s.color) }}
              >
                {Math.round(s.pct)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* --- Leyenda ---------------------------------------------------
          Siempre presente con dos o más series: la identidad nunca puede
          depender sólo de emparejar colores a ojo. El texto va en tinta; el
          color lo carga el cuadradito de al lado. */}
      <ul className="mt-3 space-y-1.5">
        {segmentos.map((s) => (
          <li key={s.categoria} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-2">{s.categoria}</span>
            <span className="cifras shrink-0 font-medium">{clp(s.ingresos)}</span>
            <span className="cifras w-9 shrink-0 text-right text-ink-3">
              {Math.round(s.pct)}%
            </span>
          </li>
        ))}
      </ul>
    </TarjetaGrafico>
  );
}

/**
 * Blanco o tinta oscura, según qué contraste mejor contra el relleno.
 *
 * Los slots claros de la paleta (amarillo, aqua, magenta) necesitan texto
 * oscuro; los oscuros, blanco. Está escrito a mano porque son ocho valores
 * conocidos — resolver `var(--sN)` en tiempo de ejecución para calcular
 * luminancia sería mucho trabajo para un resultado ya sabido.
 */
function textoSobre(color: string): string {
  const claros = ["var(--s3)", "var(--s4)", "var(--s5)"];
  return claros.includes(color) ? "#0b0b0b" : "#ffffff";
}

function TablaCategorias({
  segmentos,
  total,
}: {
  segmentos: (FilaCategoria & { pct: number })[];
  total: number;
}) {
  return (
    <table className="w-full text-xs">
      <caption className="sr-only">Ingresos por categoría</caption>
      <thead>
        <tr className="border-b border-linea text-left text-ink-2">
          <th scope="col" className="py-2 pr-3 font-medium">
            Categoría
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">
            Ingresos
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">
            Unid.
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Share
          </th>
        </tr>
      </thead>
      <tbody>
        {segmentos.map((s) => (
          <tr key={s.categoria} className="border-b border-linea/60">
            <td className="py-1.5 pr-3">{s.categoria}</td>
            <td className="cifras py-1.5 pr-3 text-right font-medium">
              {clp(s.ingresos)}
            </td>
            <td className="cifras py-1.5 pr-3 text-right text-ink-2">{s.unidades}</td>
            <td className="cifras py-1.5 text-right text-ink-2">
              {Math.round(s.pct)}%
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="font-semibold">
          <td className="py-2 pr-3">Total</td>
          <td className="cifras py-2 pr-3 text-right">{clp(total)}</td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </table>
  );
}
