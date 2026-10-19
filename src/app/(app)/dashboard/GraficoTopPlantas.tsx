"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clp, clpCorto } from "@/lib/format";
import TarjetaGrafico from "./TarjetaGrafico";
import type { FilaTopPlanta } from "./tipos";

/**
 * Las plantas que más ingresos dejaron.
 *
 * Horizontal y no vertical porque los nombres son largos ("Monstera
 * deliciosa"): en vertical habría que rotarlos 45° y se vuelven ilegibles en
 * un teléfono.
 *
 * UN SOLO COLOR para todas las barras, no una rampa de más-oscuro-donde-es-
 * mayor. Teñir por valor gastaría el único canal libre que queda repitiendo
 * información que el largo de la barra ya dice, y "planta" no es una categoría
 * con orden natural.
 */
export default function GraficoTopPlantas({ datos }: { datos: FilaTopPlanta[] }) {
  // La planta que más descuento se llevó: el dato que no se ve en el ranking.
  const masDescontada = datos.reduce<FilaTopPlanta | null>(
    (peor, d) =>
      d.descuento_promedio_pct > (peor?.descuento_promedio_pct ?? 0) ? d : peor,
    null,
  );

  return (
    <TarjetaGrafico
      titulo="Lo que más ingresos dejó"
      bajada={
        masDescontada && masDescontada.descuento_promedio_pct > 0
          ? `Ojo: ${masDescontada.nombre_planta} se vendió con ${masDescontada.descuento_promedio_pct}% de descuento promedio`
          : "Por ingresos, no por cantidad"
      }
      alto={Math.max(180, datos.length * 38 + 30)}
      tabla={<TablaTop datos={datos} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={datos}
          layout="vertical"
          margin={{ top: 0, right: 56, bottom: 0, left: 0 }}
          /* 8px de aire entre barras: el espacio es lo que las separa, no un
             borde dibujado alrededor. */
          barCategoryGap={8}
        >
          <CartesianGrid horizontal={false} stroke="var(--linea)" strokeWidth={1} />
          <XAxis
            type="number"
            tickFormatter={clpCorto}
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="nombre_planta"
            tick={{ fill: "var(--ink-2)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={96}
            interval={0}
          />
          <Tooltip content={<Globo />} cursor={{ fill: "var(--linea)", opacity: 0.4 }} />
          <Bar
            dataKey="ingresos"
            fill="var(--s1)"
            /* Punta redondeada de 4px donde terminan los datos, cuadrada en la
               línea base de donde crecen. */
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
            isAnimationActive={false}
            label={{
              position: "right",
              formatter: (v: unknown) => clp(Number(v) || 0),
              fill: "var(--ink)",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {datos.map((d) => (
              // Mismo color para todas: una serie, un color.
              <Cell key={d.nombre_planta} fill="var(--s1)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </TarjetaGrafico>
  );
}

function Globo({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: FilaTopPlanta }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="rounded-lg border border-linea bg-superficie px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{d.nombre_planta}</p>
      <p className="cifras mt-1 text-ink-2">
        {clp(d.ingresos)} · {d.unidades} unidades
      </p>
      <p className="cifras text-ink-3">
        Precio promedio {clp(d.precio_promedio)}
        {d.descuento_promedio_pct > 0 && ` · −${d.descuento_promedio_pct}% vs lista`}
      </p>
    </div>
  );
}

function TablaTop({ datos }: { datos: FilaTopPlanta[] }) {
  return (
    <table className="w-full text-xs">
      <caption className="sr-only">Plantas por ingresos</caption>
      <thead>
        <tr className="border-b border-linea text-left text-ink-2">
          <th scope="col" className="py-2 pr-3 font-medium">
            Planta
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">
            Ingresos
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">
            Unid.
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Desc.
          </th>
        </tr>
      </thead>
      <tbody>
        {datos.map((d) => (
          <tr key={d.nombre_planta} className="border-b border-linea/60">
            <td className="py-1.5 pr-3">{d.nombre_planta}</td>
            <td className="cifras py-1.5 pr-3 text-right font-medium">
              {clp(d.ingresos)}
            </td>
            <td className="cifras py-1.5 pr-3 text-right text-ink-2">{d.unidades}</td>
            <td className="cifras py-1.5 text-right text-ink-2">
              {d.descuento_promedio_pct > 0 ? `${d.descuento_promedio_pct}%` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
