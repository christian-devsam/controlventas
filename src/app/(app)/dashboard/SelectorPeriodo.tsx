"use client";

import { useRouter } from "next/navigation";

const OPCIONES = [
  { dias: 7, etiqueta: "7 días" },
  { dias: 30, etiqueta: "30 días" },
  { dias: 90, etiqueta: "90 días" },
];

/**
 * El período vive en la URL (`?dias=30`), no en el estado de React.
 *
 * Así el link se puede guardar o compartir, el botón "atrás" del teléfono
 * funciona como se espera, y los datos los trae el servidor ya agregados.
 */
export default function SelectorPeriodo({ dias }: { dias: number }) {
  const router = useRouter();

  return (
    <div
      role="group"
      aria-label="Período"
      className="mt-3 flex gap-1.5 rounded-xl border border-linea bg-superficie p-1"
    >
      {OPCIONES.map((o) => (
        <button
          key={o.dias}
          type="button"
          onClick={() => router.push(`/dashboard?dias=${o.dias}`)}
          aria-pressed={dias === o.dias}
          className={`min-h-10 flex-1 rounded-lg text-sm font-medium transition ${
            dias === o.dias ? "bg-marca text-white" : "text-ink-2"
          }`}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
