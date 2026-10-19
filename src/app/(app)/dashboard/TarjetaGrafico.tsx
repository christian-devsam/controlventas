"use client";

import { useState } from "react";

/**
 * Envoltorio común de todas las tarjetas de gráfico.
 *
 * El botón "Ver tabla" no es un extra: en la paleta hay colores que no llegan
 * a 3:1 contra el fondo, y la regla del método es que, cuando eso pasa, todo
 * valor tiene que estar disponible también como texto. Un tooltip no alcanza
 * — no se puede enfocar con teclado ni leer con lector de pantalla.
 */
export default function TarjetaGrafico({
  titulo,
  bajada,
  alto = 240,
  tabla,
  children,
}: {
  titulo: string;
  bajada?: string;
  alto?: number;
  tabla?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [verTabla, setVerTabla] = useState(false);

  return (
    <section className="tarjeta p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          {bajada && <p className="mt-0.5 text-xs text-ink-3">{bajada}</p>}
        </div>
        {tabla && (
          <button
            type="button"
            onClick={() => setVerTabla((v) => !v)}
            className="shrink-0 rounded-lg border border-linea px-2.5 py-1.5 text-xs font-medium text-ink-2"
          >
            {verTabla ? "Ver gráfico" : "Ver tabla"}
          </button>
        )}
      </div>

      {verTabla && tabla ? (
        <div className="mt-3 overflow-x-auto">{tabla}</div>
      ) : (
        /* El alto lo fija el contenedor e incluye la banda del eje X. Si sólo
           midiéramos el área de trazado, las etiquetas del eje quedarían
           afuera y la tarjeta tendría su propio scroll vertical diminuto. */
        <div className="mt-3" style={{ height: alto }}>
          {children}
        </div>
      )}
    </section>
  );
}
