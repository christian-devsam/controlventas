"use client";

import { useMemo, useState, useTransition } from "react";
import { clp } from "@/lib/format";
import { aISO, calcularPlan, desdeISO, enUnMes } from "@/lib/cuotas";
import type { ClienteParaCobro, FormaPago } from "@/lib/types";
import { marcarConfianza } from "./acciones";

const ATAJOS_CUOTAS = [2, 3, 4, 6];

type Props = {
  total: number;
  forma: FormaPago;
  setForma: (f: FormaPago) => void;
  cuotas: number;
  setCuotas: (n: number) => void;
  abono: number;
  setAbono: (n: number) => void;
  primerVence: string;
  setPrimerVence: (s: string) => void;
  cliente: ClienteParaCobro | null;
  /** Nombre escrito a mano, cuando la clienta todavía no existe. */
  clienteNuevo: string;
};

/**
 * Forma de pago: al contado o en cuotas.
 *
 * La regla del negocio es que fiar exige confianza, y acá eso es una puerta
 * real, no un cartelito: si no hay clienta elegida, o si la elegida no está
 * marcada como de confianza, la opción "En cuotas" no deja avanzar.
 *
 * Marcar a alguien de confianza es un acto aparte y explícito. No se activa
 * solo por vender fiado, porque es una decisión sobre una persona, no sobre
 * una venta.
 */
export default function SeccionCuotas({
  total,
  forma,
  setForma,
  cuotas,
  setCuotas,
  abono,
  setAbono,
  primerVence,
  setPrimerVence,
  cliente,
  clienteNuevo,
}: Props) {
  const [guardando, iniciarGuardado] = useTransition();
  const [errorConfianza, setErrorConfianza] = useState<string | null>(null);

  const hayNombreNuevo = clienteNuevo.trim().length > 0;
  // Una clienta nueva se crea ya marcada como de confianza (lo hace la función
  // de Postgres), así que escribir el nombre alcanza para habilitar cuotas.
  const puedeFiar = Boolean(cliente?.es_confianza) || hayNombreNuevo;

  const plan = useMemo(
    () =>
      calcularPlan(
        total,
        cuotas,
        abono,
        primerVence ? desdeISO(primerVence) : undefined,
      ),
    [total, cuotas, abono, primerVence],
  );

  const deudaNueva = Math.max(0, total - abono);
  const excedeCupo =
    cliente?.limite_credito != null && deudaNueva > cliente.limite_credito;

  function activarConfianza() {
    if (!cliente) return;
    setErrorConfianza(null);
    iniciarGuardado(async () => {
      const r = await marcarConfianza(cliente.id, true);
      if (!r.ok) setErrorConfianza(r.error ?? "No se pudo marcar.");
    });
  }

  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
        Forma de pago
      </legend>

      <div className="flex gap-2">
        <Opcion
          activa={forma === "contado"}
          onClick={() => setForma("contado")}
          texto="Al contado"
        />
        <Opcion
          activa={forma === "cuotas"}
          onClick={() => {
            setForma("cuotas");
            if (!primerVence) setPrimerVence(aISO(enUnMes(new Date())));
          }}
          texto="En cuotas"
        />
      </div>

      {forma === "cuotas" && (
        <div className="mt-3 rounded-xl border border-linea bg-plano p-3">
          {!puedeFiar ? (
            /* --- Puerta de confianza --------------------------------- */
            <div>
              {!cliente ? (
                <p className="text-sm">
                  <span aria-hidden="true">🔒 </span>
                  Elegí una clienta arriba, o escribí su nombre. Fiado sin saber a
                  quién no se puede cobrar después.
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    <span aria-hidden="true">🔒 </span>
                    <strong>{cliente.nombre}</strong> no está marcada como clienta de
                    confianza.
                  </p>
                  <p className="mt-1 text-xs text-ink-2">
                    Vender en cuotas es prestar plata. Marcala sólo si le vas a
                    poder cobrar.
                  </p>
                  {errorConfianza && (
                    <p role="alert" className="mt-2 text-xs text-critico-texto">
                      {errorConfianza}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={activarConfianza}
                    disabled={guardando}
                    className="mt-2.5 w-full rounded-lg border border-marca bg-marca-suave px-3 py-2.5 text-sm font-semibold text-marca disabled:opacity-60"
                  >
                    {guardando
                      ? "Guardando…"
                      : `Marcar a ${cliente.nombre} como de confianza`}
                  </button>
                </>
              )}
            </div>
          ) : (
            /* --- Armado del plan -------------------------------------- */
            <div className="space-y-3">
              <div>
                <span className="mb-1.5 block text-xs font-medium">
                  ¿En cuántas cuotas?
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ATAJOS_CUOTAS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCuotas(n)}
                      aria-pressed={cuotas === n}
                      className={`min-h-10 min-w-11 rounded-lg border px-3 text-sm font-semibold ${
                        cuotas === n
                          ? "border-marca bg-marca text-white"
                          : "border-linea bg-superficie text-ink-2"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={24}
                    value={cuotas}
                    onChange={(e) =>
                      setCuotas(Math.min(24, Math.max(2, Number(e.target.value) || 2)))
                    }
                    aria-label="Cantidad de cuotas"
                    className="cifras h-10 w-16 rounded-lg border border-linea bg-superficie px-2 text-center text-sm outline-none focus:border-marca"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">Abono hoy</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={total}
                    step={100}
                    value={abono || ""}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) =>
                      setAbono(Math.max(0, Math.min(total, Number(e.target.value) || 0)))
                    }
                    placeholder="0"
                    className="cifras h-11 w-full rounded-lg border border-linea bg-superficie px-2.5 text-sm outline-none focus:border-marca"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium">Primera cuota</span>
                  <input
                    type="date"
                    value={primerVence}
                    onChange={(e) => setPrimerVence(e.target.value)}
                    className="h-11 w-full rounded-lg border border-linea bg-superficie px-2.5 text-sm outline-none focus:border-marca"
                  />
                </label>
              </div>

              {excedeCupo && (
                <p className="rounded-lg bg-grave/10 px-3 py-2 text-xs">
                  <span aria-hidden="true">⚠️ </span>
                  Esta deuda ({clp(deudaNueva)}) pasa el cupo que le pusiste a{" "}
                  {cliente!.nombre} ({clp(cliente!.limite_credito!)}). Podés seguir
                  igual, es sólo un aviso.
                </p>
              )}

              {/* --- Vista previa del plan ---------------------------- */}
              {plan.length > 0 && (
                <div className="rounded-lg bg-superficie p-3">
                  <p className="cifras text-sm font-semibold">
                    {plan.length} cuotas de {clp(plan[0].monto)}
                    {plan[plan.length - 1].monto !== plan[0].monto &&
                      ` (la última de ${clp(plan[plan.length - 1].monto)})`}
                  </p>
                  {abono > 0 && (
                    <p className="cifras mt-0.5 text-xs text-ink-2">
                      Más {clp(abono)} que deja hoy
                    </p>
                  )}
                  <ol className="mt-2 space-y-0.5">
                    {plan.slice(0, 4).map((c) => (
                      <li
                        key={c.numero}
                        className="cifras flex justify-between text-xs text-ink-2"
                      >
                        <span>
                          Cuota {c.numero} ·{" "}
                          {c.vence.toLocaleDateString("es-CL", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        <span className="font-medium">{clp(c.monto)}</span>
                      </li>
                    ))}
                    {plan.length > 4 && (
                      <li className="text-xs text-ink-3">
                        …y {plan.length - 4} más, una por mes
                      </li>
                    )}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}

function Opcion({
  activa,
  onClick,
  texto,
}: {
  activa: boolean;
  onClick: () => void;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`min-h-11 flex-1 rounded-xl border text-sm font-semibold transition ${
        activa ? "border-marca bg-marca text-white" : "border-linea bg-plano text-ink-2"
      }`}
    >
      {texto}
    </button>
  );
}
