"use client";

import { useState } from "react";
import { clp, fechaHora } from "@/lib/format";
import { ETIQUETAS_CANAL, ETIQUETAS_PAGO, type VentaDetalle } from "@/lib/types";
import { anularVenta } from "../vender/acciones";

export default function FilaVenta({ venta }: { venta: VentaDetalle }) {
  const [abierta, setAbierta] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unidades = venta.venta_items.reduce((s, i) => s + i.cantidad, 0);

  async function anular() {
    setAnulando(true);
    const r = await anularVenta(venta.id);
    if (!r.ok) {
      setAnulando(false);
      setConfirmando(false);
      setError(r.error ?? "No se pudo anular.");
    }
    // Si salió bien, `revalidatePath` hace desaparecer la fila sola.
  }

  return (
    <div className="tarjeta overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {venta.clientes?.nombre ?? `Venta #${venta.folio}`}
          </p>
          <p className="cifras mt-0.5 text-xs text-ink-3">
            {fechaHora(venta.fecha)} · {unidades}{" "}
            {unidades === 1 ? "planta" : "plantas"} · {ETIQUETAS_PAGO[venta.metodo_pago]}
          </p>
        </div>
        <div className="text-right">
          <p className="cifras text-base font-semibold">{clp(venta.total)}</p>
          {venta.descuento_total > 0 && (
            <p className="cifras text-xs text-marca">−{clp(venta.descuento_total)}</p>
          )}
        </div>
        <span className="text-ink-3" aria-hidden="true">
          {abierta ? "▲" : "▼"}
        </span>
      </button>

      {abierta && (
        <div className="border-t border-linea px-3 py-3">
          <ul className="space-y-1.5 text-sm">
            {venta.venta_items.map((i) => (
              <li key={i.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 flex-1 truncate">
                  <span className="cifras text-ink-3">{i.cantidad}×</span>{" "}
                  {i.nombre_planta}
                </span>
                <span className="cifras shrink-0">
                  {clp(i.subtotal)}
                  {i.precio_unitario !== i.precio_lista && (
                    <span className="ml-1 text-xs text-ink-3 line-through">
                      {clp(i.cantidad * i.precio_lista)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
            <div className="flex gap-1">
              <dt>Folio:</dt>
              <dd className="cifras font-medium text-ink-2">#{venta.folio}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Canal:</dt>
              <dd className="font-medium text-ink-2">{ETIQUETAS_CANAL[venta.canal]}</dd>
            </div>
          </dl>

          {venta.notas && (
            <p className="mt-2 rounded-lg bg-plano px-3 py-2 text-xs text-ink-2">
              {venta.notas}
            </p>
          )}

          {error && (
            <p role="alert" className="mt-2 text-xs text-critico-texto">
              {error}
            </p>
          )}

          <div className="mt-3 border-t border-linea pt-3">
            {confirmando ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={anular}
                  disabled={anulando}
                  className="flex-1 rounded-lg bg-critico px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {anulando ? "Anulando…" : "Sí, anular"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  disabled={anulando}
                  className="flex-1 rounded-lg border border-linea px-3 py-2.5 text-sm font-medium"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="text-sm font-medium text-critico-texto underline"
              >
                Anular esta venta
              </button>
            )}
            {confirmando && (
              <p className="mt-2 text-xs text-ink-3">
                Las plantas vuelven al stock. Queda registrado en el historial de
                movimientos.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
