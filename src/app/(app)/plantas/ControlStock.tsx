"use client";

import { useState } from "react";
import Hoja from "@/components/Hoja";
import type { Planta } from "@/lib/types";
import { moverStock } from "./acciones";

type Tipo = "ingreso" | "merma" | "ajuste";

const TIPOS: { valor: Tipo; etiqueta: string; ayuda: string }[] = [
  {
    valor: "ingreso",
    etiqueta: "Llegó mercadería",
    ayuda: "Suma al stock. Para cuando repones del vivero.",
  },
  {
    valor: "merma",
    etiqueta: "Se perdió / se murió",
    ayuda: "Resta del stock. Queda registrado como pérdida, no como venta.",
  },
  {
    valor: "ajuste",
    etiqueta: "Corregir el conteo",
    ayuda: "Para cuando contás y el número no coincide. Puede ser +/−.",
  },
];

export default function ControlStock({
  planta,
  onCerrar,
}: {
  planta: Planta;
  onCerrar: () => void;
}) {
  const [tipo, setTipo] = useState<Tipo>("ingreso");
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = Number(cantidad) || 0;
  // En "ajuste" el signo lo escribe Camila; en los otros dos lo determina el
  // tipo de movimiento, así no hay que pensar en signos.
  const delta = tipo === "merma" ? -Math.abs(n) : tipo === "ingreso" ? Math.abs(n) : n;
  const resultante = planta.stock + delta;

  async function guardar() {
    setGuardando(true);
    setError(null);

    const r = await moverStock({
      planta_id: planta.id,
      cantidad: delta,
      tipo,
      nota: nota.trim() || undefined,
    });

    if (!r.ok) {
      setGuardando(false);
      setError(r.error);
      return;
    }
    onCerrar();
  }

  return (
    <Hoja
      titulo={`Stock · ${planta.nombre}`}
      onCerrar={onCerrar}
      pie={
        <>
          {error && (
            <p role="alert" className="mb-2 text-sm text-critico-texto">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || delta === 0}
            className="w-full rounded-xl bg-marca px-4 py-3.5 text-base font-semibold text-white active:scale-[0.98] disabled:opacity-60"
          >
            {guardando
              ? "Guardando…"
              : delta === 0
                ? "Escribí una cantidad"
                : `Guardar · stock queda en ${resultante}`}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-plano p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-ink-3">Stock actual</p>
          <p className="cifras mt-1 text-3xl font-bold">{planta.stock}</p>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">¿Qué pasó?</legend>
          <div className="space-y-2">
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTipo(t.valor)}
                aria-pressed={tipo === t.valor}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  tipo === t.valor
                    ? "border-marca bg-marca-suave"
                    : "border-linea bg-plano"
                }`}
              >
                <span className="block text-sm font-medium">{t.etiqueta}</span>
                <span className="mt-0.5 block text-xs text-ink-3">{t.ayuda}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Cantidad {tipo === "ajuste" && <span className="text-ink-3">(puede ser negativa)</span>}
          </span>
          <input
            type="number"
            inputMode={tipo === "ajuste" ? "text" : "numeric"}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            autoFocus
            placeholder="0"
            className="cifras w-full rounded-xl border border-linea bg-plano px-3 py-3 text-center text-2xl font-semibold outline-none focus:border-marca focus:ring-2 focus:ring-marca/25"
          />
        </label>

        {delta !== 0 && (
          <p className="cifras text-center text-sm text-ink-2">
            {planta.stock} {delta > 0 ? "+" : "−"} {Math.abs(delta)} ={" "}
            <span
              className={`font-bold ${resultante < 0 ? "text-critico-texto" : "text-ink"}`}
            >
              {resultante}
            </span>
            {resultante < 0 && (
              <span className="mt-1 block text-xs text-critico-texto">
                Queda en negativo. Revisá el número antes de guardar.
              </span>
            )}
          </p>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Nota (opcional)</span>
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: compra en vivero Los Aromos"
            className="w-full rounded-xl border border-linea bg-plano px-3 py-3 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/25"
          />
        </label>
      </div>
    </Hoja>
  );
}
