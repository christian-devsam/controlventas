import { clp } from "@/lib/format";
import type { FilaMapa } from "./tipos";

/**
 * Mapa de calor: qué día y a qué hora se vende.
 *
 * La pregunta que responde es operativa: ¿cuándo conviene estar en el local,
 * cuándo lanzar una promo, cuándo publicar en Instagram? Un día con la fila
 * entera clara es un día que quizás no vale la pena abrir.
 *
 * Es magnitud continua, así que la escala es SECUENCIAL: un solo tono, de
 * claro a oscuro. Nunca un arcoíris — con varios tonos hay que ir a la leyenda
 * para cada celda, y el orden deja de leerse de un vistazo.
 *
 * El tono es azul y no verde a propósito: en esta app el verde ya significa
 * "serie de datos", y un mismo tono no puede cargar dos significados.
 *
 * Son 90 días fijos, no el período del selector: con 7 días la grilla queda
 * casi toda vacía y no dice nada. La bajada lo aclara.
 */
export default function MapaHorario({ datos }: { datos: FilaMapa[] }) {
  if (!datos.length) return null;

  const maximo = Math.max(...datos.map((d) => d.ingresos));
  if (maximo === 0) return null;

  const bloques = [...new Set(datos.map((d) => d.bloque_nombre))];
  const dias = [...new Set(datos.map((d) => d.dia_nombre))];

  const celda = (dia: string, bloque: string) =>
    datos.find((d) => d.dia_nombre === dia && d.bloque_nombre === bloque);

  /** Siete pasos de la rampa. Más que eso y los niveles vecinos se confunden. */
  const paso = (ingresos: number) => {
    if (ingresos === 0) return "var(--seq-0)";
    const n = Math.ceil((ingresos / maximo) * 6);
    return `var(--seq-${Math.min(6, Math.max(1, n))})`;
  };

  const mejor = datos.reduce((max, d) => (d.ingresos > max.ingresos ? d : max), datos[0]);

  return (
    <section className="tarjeta p-4">
      <h2 className="text-sm font-semibold">Cuándo se vende</h2>
      <p className="mt-0.5 text-xs text-ink-3">
        Últimos 90 días · el mejor momento es {mejor.dia_nombre} por la{" "}
        {mejor.bloque_nombre.toLowerCase()}
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[260px] border-separate border-spacing-0.5">
          <caption className="sr-only">
            Ingresos por día de la semana y momento del día
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-9" />
              {bloques.map((b) => (
                <th
                  key={b}
                  scope="col"
                  className="pb-1 text-[10px] font-medium text-ink-3"
                >
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr key={d}>
                <th
                  scope="row"
                  className="pr-1 text-right text-[11px] font-medium text-ink-2"
                >
                  {d}
                </th>
                {bloques.map((b) => {
                  const c = celda(d, b);
                  const ingresos = c?.ingresos ?? 0;
                  return (
                    <td key={b} className="p-0">
                      {/* `title` da el valor al pasar el mouse; el texto del
                          sr-only lo da a los lectores de pantalla. El color
                          nunca es la única vía: la tabla de abajo repite todo. */}
                      <div
                        title={`${d} ${b}: ${clp(ingresos)} · ${c?.ventas ?? 0} ventas`}
                        className="flex h-9 items-center justify-center rounded"
                        style={{ background: paso(ingresos) }}
                      >
                        <span className="sr-only">
                          {d} {b}: {clp(ingresos)}
                        </span>
                        {/* Sólo las celdas fuertes llevan número: una cifra en
                            las 28 celdas sería ruido. */}
                        {ingresos > 0 && ingresos / maximo >= 0.6 && (
                          <span
                            className="cifras text-[10px] font-bold"
                            style={{ color: "#ffffff" }}
                          >
                            {c?.ventas}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Leyenda de escala ---------------------------------------------
          Una escala secuencial siempre necesita leyenda: sin ella, un color
          no se puede traducir a un número. */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-ink-3">Menos</span>
        <div className="flex flex-1 gap-0.5">
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-2 flex-1 rounded-sm"
              style={{ background: `var(--seq-${n})` }}
            />
          ))}
        </div>
        <span className="cifras text-[10px] text-ink-3">{clp(maximo)}</span>
      </div>
    </section>
  );
}
