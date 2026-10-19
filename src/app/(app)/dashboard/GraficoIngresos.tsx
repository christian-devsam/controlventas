"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clp, clpCorto, fechaCorta } from "@/lib/format";
import TarjetaGrafico from "./TarjetaGrafico";
import type { FilaSerie } from "./tipos";

/**
 * Ingresos día por día.
 *
 * Una sola serie → un solo color y nada de leyenda: el título ya dice qué se
 * está mirando, y una leyenda de un ítem sólo repetiría el título.
 *
 * Los días sin ventas vienen como 0 desde la base (`generate_series` en
 * 0005_panel.sql). Es importante: si faltaran, la línea uniría el día 3 con el
 * día 5 como si fueran seguidos y el bajón desaparecería del gráfico justo
 * cuando es lo más importante de ver.
 */
export default function GraficoIngresos({
  datos,
  dias,
}: {
  datos: FilaSerie[];
  dias: number;
}) {
  const ultimo = datos.length - 1;
  const mejor = datos.reduce(
    (max, d) => (d.ingresos > max.ingresos ? d : max),
    datos[0] ?? { dia: "", ingresos: 0 },
  );

  return (
    <TarjetaGrafico
      titulo="Ingresos por día"
      bajada={`Últimos ${dias} días · mejor día ${fechaCorta(mejor.dia)} con ${clp(mejor.ingresos)}`}
      alto={240}
      tabla={<TablaSerie datos={datos} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 22, right: 8, bottom: 0, left: -8 }}>
          {/* Rejilla sólo horizontal y en hairline sólido: tiene que leerse
              como fondo, no competir con la línea. Nunca punteada — el punteado
              se lee como "proyección" o "umbral". */}
          <CartesianGrid
            vertical={false}
            stroke="var(--linea)"
            strokeWidth={1}
          />
          <XAxis
            dataKey="dia"
            tickFormatter={fechaCorta}
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--eje)" }}
            // En 90 días no caben 90 etiquetas: Recharts va salteando.
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            tickFormatter={clpCorto}
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            content={<Globo />}
            // Línea guía vertical al pasar el dedo/mouse.
            cursor={{ stroke: "var(--eje)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="ingresos"
            stroke="var(--s1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="var(--s1)"
            // Lavado al 10%: acompaña la línea sin convertirse en un bloque.
            fillOpacity={0.1}
            dot={(props) => <PuntoFinal {...props} esUltimo={props.index === ultimo} />}
            activeDot={{
              r: 5,
              fill: "var(--s1)",
              // Anillo del color de la superficie, no un borde: así el punto
              // se lee aunque caiga encima de la línea.
              stroke: "var(--superficie)",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </TarjetaGrafico>
  );
}

/* --- Punto y etiqueta del último día ------------------------------------
   Se etiqueta sólo el extremo. Un número sobre cada punto sería ilegible y
   nadie lo lee; el eje y el tooltip cargan el resto. */
type PropsPunto = {
  cx?: number;
  cy?: number;
  index?: number;
  esUltimo?: boolean;
  payload?: FilaSerie;
};

function PuntoFinal({ cx, cy, index, esUltimo, payload }: PropsPunto) {
  if (!esUltimo || cx == null || cy == null) {
    // Recharts espera un elemento SVG, no `null`.
    return <g key={`vacio-${index}`} />;
  }
  return (
    <g key={`fin-${index}`}>
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill="var(--s1)"
        stroke="var(--superficie)"
        strokeWidth={2}
      />
      <text
        x={cx}
        y={cy - 12}
        /* textAnchor="end" porque el último punto está pegado al borde
           derecho: centrado se saldría de la tarjeta. */
        textAnchor="end"
        fontSize={12}
        fontWeight={600}
        /* El texto usa tinta, nunca el color de la serie. */
        fill="var(--ink)"
      >
        {clpCorto(payload?.ingresos ?? 0)}
      </text>
    </g>
  );
}

function Globo({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: FilaSerie }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="rounded-lg border border-linea bg-superficie px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{fechaCorta(d.dia)}</p>
      <p className="cifras mt-1 text-ink-2">
        {clp(d.ingresos)} · {d.ventas} {d.ventas === 1 ? "venta" : "ventas"}
      </p>
      {d.ventas > 0 && (
        <p className="cifras text-ink-3">
          {d.unidades} plantas · ticket {clp(d.ticket_promedio)}
        </p>
      )}
    </div>
  );
}

function TablaSerie({ datos }: { datos: FilaSerie[] }) {
  return (
    <table className="w-full text-xs">
      <caption className="sr-only">Ingresos por día</caption>
      <thead>
        <tr className="border-b border-linea text-left text-ink-2">
          <th scope="col" className="py-2 pr-3 font-medium">
            Día
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">
            Ingresos
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">
            Ventas
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Ticket
          </th>
        </tr>
      </thead>
      <tbody className="cifras">
        {[...datos].reverse().map((d) => (
          <tr key={d.dia} className="border-b border-linea/60">
            <td className="py-1.5 pr-3">{fechaCorta(d.dia)}</td>
            <td className="py-1.5 pr-3 text-right font-medium">{clp(d.ingresos)}</td>
            <td className="py-1.5 pr-3 text-right text-ink-2">{d.ventas}</td>
            <td className="py-1.5 text-right text-ink-2">
              {d.ventas > 0 ? clp(d.ticket_promedio) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
