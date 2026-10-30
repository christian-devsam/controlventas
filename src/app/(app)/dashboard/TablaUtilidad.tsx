"use client";

import { useState } from "react";
import { clp, numero } from "@/lib/format";
import type { FilaUtilidad } from "./tipos";

type Orden = "utilidad" | "unidades";

/**
 * Los dos rankings que pide el negocio, en una sola tarjeta con un
 * interruptor.
 *
 * Están juntos a propósito: la pregunta interesante no es "¿cuál deja más?"
 * ni "¿cuál vende más?" por separado, es la DIFERENCIA entre las dos listas.
 * La planta que encabeza ventas y no aparece en utilidad es la que se está
 * vendiendo mucho para ganar poco. Dos tarjetas separadas en la pantalla
 * esconderían justamente eso.
 *
 * Es una tabla y no un gráfico porque son números que se comparan entre sí y
 * se leen exactos. Una barra obligaría a estimar alturas para después igual
 * querer ver la cifra.
 */
export default function TablaUtilidad({
  datos,
  dias,
}: {
  datos: FilaUtilidad[];
  dias: number;
}) {
  const [orden, setOrden] = useState<Orden>("utilidad");

  if (!datos.length) return null;

  const ordenadas = [...datos].sort((a, b) =>
    orden === "utilidad" ? b.utilidad - a.utilidad : b.unidades - a.unidades,
  );
  const top = ordenadas.slice(0, 10);

  const utilidadTotal = datos.reduce((s, d) => s + d.utilidad, 0);
  const ingresosTotal = datos.reduce((s, d) => s + d.ingresos, 0);
  const sinCosto = datos.reduce((s, d) => s + d.unidades_sin_costo, 0);
  const margenGlobal =
    ingresosTotal > 0 ? Math.round((utilidadTotal / ingresosTotal) * 100) : 0;

  // La contradicción que vale la pena señalar: lidera en ventas pero no en
  // ganancia.
  const masVendida = [...datos].sort((a, b) => b.unidades - a.unidades)[0];
  const masRentable = [...datos].sort((a, b) => b.utilidad - a.utilidad)[0];
  const sonDistintas = masVendida.nombre_planta !== masRentable.nombre_planta;

  return (
    <section className="tarjeta p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Qué deja plata</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Últimos {dias} días · margen {margenGlobal}%
          </p>
        </div>
        <div
          role="group"
          aria-label="Ordenar ranking"
          className="flex shrink-0 rounded-lg border border-linea p-0.5"
        >
          <BotonOrden
            activo={orden === "utilidad"}
            onClick={() => setOrden("utilidad")}
            texto="Utilidad"
          />
          <BotonOrden
            activo={orden === "unidades"}
            onClick={() => setOrden("unidades")}
            texto="Vendidas"
          />
        </div>
      </div>

      {/* Utilidad total, la cifra que resume la tarjeta. */}
      <p className="mt-3 text-3xl font-semibold leading-none tracking-tight">
        {clp(utilidadTotal)}
      </p>
      <p className="mt-1 text-xs text-ink-2">
        de ganancia sobre {clp(ingresosTotal)} vendidos
      </p>

      {sonDistintas && (
        <p className="mt-3 rounded-lg bg-plano px-3 py-2 text-xs text-ink-2">
          <span aria-hidden="true">💡 </span>
          La que más vendés (<strong>{masVendida.nombre_planta}</strong>) no es la
          que más te deja (<strong>{masRentable.nombre_planta}</strong>).
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">
            Ranking de plantas por {orden === "utilidad" ? "utilidad" : "unidades vendidas"}
          </caption>
          <thead>
            <tr className="border-b border-linea text-left text-ink-2">
              <th scope="col" className="py-2 pr-2 font-medium">
                #
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Planta
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Unid.
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Utilidad
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Margen
              </th>
            </tr>
          </thead>
          <tbody>
            {top.map((d, i) => (
              <tr key={d.nombre_planta} className="border-b border-linea/60">
                <td className="cifras py-2 pr-2 text-ink-3">{i + 1}</td>
                <td className="py-2 pr-3">
                  <span className="font-medium">{d.nombre_planta}</span>
                  {d.unidades_sin_costo > 0 && (
                    <span className="mt-0.5 block text-[10px] text-grave">
                      ⚠ {d.unidades_sin_costo} sin costo cargado
                    </span>
                  )}
                </td>
                <td className="cifras py-2 pr-3 text-right text-ink-2">
                  {numero(d.unidades)}
                </td>
                <td
                  className={`cifras py-2 pr-3 text-right font-semibold ${
                    d.utilidad < 0 ? "text-critico-texto" : ""
                  }`}
                >
                  {clp(d.utilidad)}
                </td>
                <td className="cifras py-2 text-right text-ink-2">
                  {d.margen_pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sinCosto > 0 && (
        /* El aviso que hace que el número de arriba sea creíble: si falta
           costo, la utilidad que se muestra es PARCIAL, no optimista. */
        <p className="mt-3 rounded-lg bg-grave/10 px-3 py-2 text-xs">
          <span aria-hidden="true">⚠️ </span>
          Hay <strong>{sinCosto}</strong>{" "}
          {sinCosto === 1 ? "unidad vendida" : "unidades vendidas"} sin costo
          cargado. No entran en esta utilidad, así que el número real es más
          bajo. Cargá el costo en la pantalla Plantas.
        </p>
      )}
    </section>
  );
}

function BotonOrden({
  activo,
  onClick,
  texto,
}: {
  activo: boolean;
  onClick: () => void;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
        activo ? "bg-marca text-white" : "text-ink-2"
      }`}
    >
      {texto}
    </button>
  );
}
