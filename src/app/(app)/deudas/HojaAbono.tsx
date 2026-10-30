"use client";

import { useState } from "react";
import Hoja from "@/components/Hoja";
import { clp } from "@/lib/format";
import { ETIQUETAS_PAGO, METODOS_PAGO, type Deuda, type MetodoPago } from "@/lib/types";
import { registrarPago } from "./acciones";

export default function HojaAbono({
  deuda,
  onCerrar,
}: {
  deuda: Deuda;
  onCerrar: () => void;
}) {
  const [monto, setMonto] = useState<string>(String(deuda.proximo_monto ?? ""));
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = Math.max(0, Math.round(Number(monto) || 0));
  const quedaria = deuda.saldo - n;
  const valido = n > 0 && n <= deuda.saldo;

  async function guardar() {
    setGuardando(true);
    setError(null);

    const r = await registrarPago({
      venta_id: deuda.venta_id,
      monto: n,
      metodo_pago: metodo,
      nota: nota.trim() || null,
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
      titulo={`Abono · ${deuda.cliente}`}
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
            disabled={guardando || !valido}
            className="w-full rounded-xl bg-marca px-4 py-3.5 text-base font-semibold text-white active:scale-[0.98] disabled:opacity-60"
          >
            {guardando
              ? "Guardando…"
              : !valido
                ? "Escribí un monto"
                : quedaria === 0
                  ? "Registrar y saldar la deuda"
                  : `Registrar · quedan ${clp(quedaria)}`}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-plano p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-ink-3">Debe</p>
          <p className="cifras mt-1 text-3xl font-bold">{clp(deuda.saldo)}</p>
          <p className="cifras mt-1 text-xs text-ink-3">
            de {clp(deuda.total)} · venta #{deuda.folio}
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">¿Cuánto abona?</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={deuda.saldo}
            step={100}
            value={monto}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setMonto(e.target.value)}
            className="cifras w-full rounded-xl border border-linea bg-plano px-3 py-3 text-center text-2xl font-semibold outline-none focus:border-marca focus:ring-2 focus:ring-marca/25"
          />
          {n > deuda.saldo && (
            <span className="mt-1 block text-xs text-critico-texto">
              Es más de lo que debe. El máximo es {clp(deuda.saldo)}.
            </span>
          )}
        </label>

        {/* Atajos para los dos montos que se usan el 90% de las veces. */}
        <div className="flex gap-2">
          {deuda.proximo_monto != null && deuda.proximo_monto <= deuda.saldo && (
            <button
              type="button"
              onClick={() => setMonto(String(deuda.proximo_monto))}
              className="min-h-11 flex-1 rounded-xl border border-linea bg-plano text-sm font-medium"
            >
              La cuota · {clp(deuda.proximo_monto)}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMonto(String(deuda.saldo))}
            className="min-h-11 flex-1 rounded-xl border border-linea bg-plano text-sm font-medium"
          >
            Todo · {clp(deuda.saldo)}
          </button>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">¿Cómo pagó?</legend>
          <div className="flex flex-wrap gap-2">
            {METODOS_PAGO.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetodo(m)}
                aria-pressed={metodo === m}
                className={`min-h-11 rounded-full border px-4 text-sm font-medium ${
                  metodo === m
                    ? "border-marca bg-marca text-white"
                    : "border-linea bg-plano text-ink-2"
                }`}
              >
                {ETIQUETAS_PAGO[m]}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Nota (opcional)</span>
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: dijo que el resto el viernes"
            className="w-full rounded-xl border border-linea bg-plano px-3 py-3 text-base outline-none focus:border-marca"
          />
        </label>
      </div>
    </Hoja>
  );
}
