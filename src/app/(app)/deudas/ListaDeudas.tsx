"use client";

import { useState } from "react";
import { clp, fechaCorta } from "@/lib/format";
import type { ClienteDeuda, Deuda } from "@/lib/types";
import HojaAbono from "./HojaAbono";

/**
 * Deudas agrupadas por clienta, no por venta.
 *
 * Es la forma en que se piensa el problema: no es "la venta #41 debe $12.000",
 * es "Marcela me debe $30.000". Si una clienta tiene tres ventas abiertas,
 * acá aparece una vez, y adentro se abren las tres.
 */
export default function ListaDeudas({
  clientes,
  deudas,
}: {
  clientes: ClienteDeuda[];
  deudas: Deuda[];
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState<Deuda | null>(null);

  return (
    <>
      <ul className="mt-4 space-y-2">
        {clientes.map((c) => {
          const clave = c.cliente_id ?? c.cliente;
          const suyas = deudas.filter((d) => d.cliente_id === c.cliente_id);
          const atrasada = c.vencido_total > 0;

          return (
            <li key={clave} className="tarjeta overflow-hidden">
              <button
                type="button"
                onClick={() => setAbierta((a) => (a === clave ? null : clave))}
                aria-expanded={abierta === clave}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.cliente}</p>
                  <p className="cifras mt-0.5 text-xs text-ink-3">
                    {c.ventas_abiertas}{" "}
                    {c.ventas_abiertas === 1 ? "venta abierta" : "ventas abiertas"}
                    {c.proximo_vence && ` · próxima ${fechaCorta(c.proximo_vence)}`}
                  </p>
                  {atrasada && (
                    /* Ícono + texto, nunca sólo color: el atraso se lee igual
                       con daltonismo o a pleno sol. */
                    <p className="cifras mt-1 text-xs font-medium text-critico-texto">
                      ⚠ {clp(c.vencido_total)} vencido
                      {c.peor_atraso ? ` · ${c.peor_atraso} días` : ""}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="cifras text-base font-semibold">
                    {clp(c.deuda_total)}
                  </p>
                  {c.cupo_disponible !== null && (
                    <p className="cifras text-[11px] text-ink-3">
                      cupo {clp(c.cupo_disponible)}
                    </p>
                  )}
                </div>

                <span className="text-ink-3" aria-hidden="true">
                  {abierta === clave ? "▲" : "▼"}
                </span>
              </button>

              {abierta === clave && (
                <div className="border-t border-linea">
                  {c.telefono && (
                    <a
                      href={`https://wa.me/${c.telefono.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 border-b border-linea px-3 py-2.5 text-sm font-medium text-marca"
                    >
                      <span aria-hidden="true">💬</span>
                      Escribirle por WhatsApp
                    </a>
                  )}

                  <ul className="divide-y divide-linea">
                    {suyas.map((d) => (
                      <li key={d.venta_id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="cifras text-xs font-medium">
                              Venta #{d.folio} · {fechaCorta(d.fecha)}
                            </p>
                            <p className="cifras mt-0.5 text-[11px] text-ink-3">
                              Pagó {clp(d.pagado)} de {clp(d.total)}
                              {d.total_cuotas ? ` · ${d.total_cuotas} cuotas` : ""}
                            </p>
                            {d.proximo_vence && (
                              <p
                                className={`cifras mt-0.5 text-[11px] ${
                                  d.dias_de_atraso && d.dias_de_atraso > 0
                                    ? "font-medium text-critico-texto"
                                    : "text-ink-3"
                                }`}
                              >
                                Cuota {d.proxima_cuota} de {clp(d.proximo_monto ?? 0)}
                                {d.dias_de_atraso && d.dias_de_atraso > 0
                                  ? ` · ${d.dias_de_atraso} días de atraso`
                                  : ` · vence ${fechaCorta(d.proximo_vence)}`}
                              </p>
                            )}
                          </div>
                          <p className="cifras shrink-0 text-sm font-semibold">
                            {clp(d.saldo)}
                          </p>
                        </div>

                        {/* --- Barra de avance -------------------------
                            No es decoración: ver "va por la mitad" cambia
                            cómo se encara la conversación de cobro. */}
                        <div
                          className="mt-2 h-1.5 overflow-hidden rounded-full bg-linea"
                          role="img"
                          aria-label={`Pagado ${Math.round((d.pagado / d.total) * 100)} por ciento`}
                        >
                          <div
                            className="h-full rounded-full bg-marca"
                            style={{
                              width: `${Math.min(100, (d.pagado / d.total) * 100)}%`,
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setCobrando(d)}
                          className="mt-2.5 w-full rounded-lg bg-marca px-3 py-2.5 text-sm font-semibold text-white active:scale-[0.98]"
                        >
                          Registrar abono
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {cobrando && (
        <HojaAbono deuda={cobrando} onCerrar={() => setCobrando(null)} />
      )}
    </>
  );
}
