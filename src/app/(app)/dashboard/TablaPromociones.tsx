import { clp } from "@/lib/format";
import type { FilaPromocion } from "./tipos";

/**
 * Impacto de las promociones.
 *
 * Es una tabla y no un gráfico a propósito: la pregunta tiene dos números por
 * promoción (lo que entró y lo que se resignó) y lo que importa es la relación
 * entre ambos. Un gráfico de barras agrupadas obligaría a comparar alturas
 * para después igual querer ver el número exacto.
 *
 * La columna "Costó" es la que casi nunca se mide: una promoción que vendió
 * mucho pero resignó más de lo que trajo no está funcionando, está regalando.
 */
export default function TablaPromociones({ datos }: { datos: FilaPromocion[] }) {
  if (!datos.length) {
    return (
      <section className="tarjeta p-4">
        <h2 className="text-sm font-semibold">Promociones</h2>
        <p className="mt-2 text-xs text-ink-3">
          No se aplicó ninguna promoción en este período. Cuando apliques algunas,
          acá vas a poder ver cuánto trajo cada una y cuánto costó.
        </p>
      </section>
    );
  }

  const totalResignado = datos.reduce((s, d) => s + d.ingreso_resignado, 0);

  return (
    <section className="tarjeta p-4">
      <h2 className="text-sm font-semibold">Promociones</h2>
      <p className="mt-0.5 text-xs text-ink-3">
        En total se resignaron {clp(totalResignado)} en descuentos
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-linea text-left text-ink-2">
              <th scope="col" className="py-2 pr-3 font-medium">
                Promoción
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Trajo
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Costó
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Usos
              </th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d) => {
              // Cuánto se resignó por cada peso que entró.
              const ratio =
                d.ingreso_generado > 0 ? d.ingreso_resignado / d.ingreso_generado : 0;
              return (
                <tr key={d.nombre} className="border-b border-linea/60">
                  <td className="py-2 pr-3">
                    <span className="font-medium">{d.nombre}</span>
                    {ratio > 0.25 && (
                      /* Icono + texto, nunca sólo color: así el aviso se lee
                         igual con daltonismo o en blanco y negro. */
                      <span className="mt-0.5 block text-[10px] text-grave">
                        ⚠ resigna {Math.round(ratio * 100)}% de lo que trae
                      </span>
                    )}
                  </td>
                  <td className="cifras py-2 pr-3 text-right font-medium">
                    {clp(d.ingreso_generado)}
                  </td>
                  <td className="cifras py-2 pr-3 text-right text-ink-2">
                    −{clp(d.ingreso_resignado)}
                  </td>
                  <td className="cifras py-2 text-right text-ink-2">
                    {d.ventas_con_promo}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
