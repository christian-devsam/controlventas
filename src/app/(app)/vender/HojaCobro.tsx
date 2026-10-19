"use client";

import { useEffect, useState } from "react";
import { clp } from "@/lib/format";
import { etiquetaPromocion, precioConPromocion } from "@/lib/promociones";
import {
  CANALES,
  ETIQUETAS_CANAL,
  ETIQUETAS_PAGO,
  METODOS_PAGO,
  type Canal,
  type Cliente,
  type ItemCarrito,
  type MetodoPago,
  type Promocion,
} from "@/lib/types";
import { registrarVenta } from "./acciones";

type Props = {
  carrito: ItemCarrito[];
  setCarrito: React.Dispatch<React.SetStateAction<ItemCarrito[]>>;
  promociones: Promocion[];
  clientes: Pick<Cliente, "id" | "nombre" | "telefono">[];
  onCerrar: () => void;
  onGuardada: (folio: number, total: number) => void;
};

export default function HojaCobro({
  carrito,
  setCarrito,
  promociones,
  clientes,
  onCerrar,
  onGuardada,
}: Props) {
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [canal, setCanal] = useState<Canal>("tienda");
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNuevo, setClienteNuevo] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editandoPromo, setEditandoPromo] = useState<string | null>(null);

  const total = carrito.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const lista = carrito.reduce((s, i) => s + i.cantidad * i.precio_lista, 0);
  const descuento = Math.max(0, lista - total);

  // Cerrar con Escape — gratis en escritorio, no molesta en el teléfono.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !guardando) onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar, guardando]);

  // Mientras la hoja está abierta, el fondo no debe hacer scroll.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  function cambiar(key: string, cambios: Partial<ItemCarrito>) {
    setCarrito((a) => a.map((i) => (i.key === key ? { ...i, ...cambios } : i)));
  }

  function quitar(key: string) {
    setCarrito((a) => {
      const resto = a.filter((i) => i.key !== key);
      if (resto.length === 0) onCerrar();
      return resto;
    });
  }

  function aplicarPromo(item: ItemCarrito, promo: Promocion | null) {
    cambiar(item.key, {
      promocion_id: promo?.id ?? null,
      promocion_nombre: promo?.nombre ?? null,
      precio_unitario: promo
        ? precioConPromocion(item.precio_lista, promo, item.cantidad)
        : item.precio_lista,
    });
    setEditandoPromo(null);
  }

  async function cobrar() {
    setGuardando(true);
    setError(null);

    const resultado = await registrarVenta({
      items: carrito.map((i) => ({
        planta_id: i.planta_id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        precio_lista: i.precio_lista,
        promocion_id: i.promocion_id,
      })),
      canal,
      metodo_pago: metodoPago,
      cliente_id: clienteId || null,
      cliente_nombre: clienteId ? null : clienteNuevo.trim() || null,
      notas: notas.trim() || null,
    });

    if (!resultado.ok) {
      setGuardando(false);
      setError(resultado.error);
      return;
    }

    onGuardada(resultado.folio, resultado.total);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Fondo: cierra al tocarlo. */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => !guardando && onCerrar()}
        className="absolute inset-0 bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cobrar venta"
        className="relative mx-auto flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-superficie"
      >
        {/* --- Encabezado fijo -------------------------------------------- */}
        <div className="flex items-center justify-between border-b border-linea px-4 py-3">
          <h2 className="text-base font-semibold">Cobrar</h2>
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2"
          >
            Seguir agregando
          </button>
        </div>

        {/* --- Cuerpo con scroll ------------------------------------------ */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <ul className="space-y-2.5">
            {carrito.map((item) => {
              const excedeStock = item.cantidad > item.stock_disponible;
              return (
                <li key={item.key} className="rounded-xl border border-linea p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xl leading-none" aria-hidden="true">
                      {item.emoji ?? "🪴"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.nombre}</p>
                      {item.promocion_nombre && (
                        <p className="mt-0.5 text-xs font-medium text-marca">
                          {item.promocion_nombre}
                        </p>
                      )}
                      {excedeStock && (
                        /* No bloqueamos la venta: perder una venta real es peor
                           que un stock desactualizado. Sólo avisamos. */
                        <p className="mt-0.5 text-xs text-grave">
                          Más de lo que marca el stock ({item.stock_disponible})
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => quitar(item.key)}
                      aria-label={`Quitar ${item.nombre}`}
                      className="-m-2 p-2 text-lg text-ink-3"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    {/* --- Cantidad ----------------------------------------- */}
                    <div className="flex items-center rounded-lg border border-linea">
                      <button
                        type="button"
                        aria-label="Quitar una unidad"
                        onClick={() =>
                          item.cantidad > 1
                            ? cambiar(item.key, { cantidad: item.cantidad - 1 })
                            : quitar(item.key)
                        }
                        className="flex h-10 w-10 items-center justify-center text-lg font-medium text-ink-2"
                      >
                        −
                      </button>
                      <span className="cifras w-8 text-center text-sm font-semibold">
                        {item.cantidad}
                      </span>
                      <button
                        type="button"
                        aria-label="Agregar una unidad"
                        onClick={() => cambiar(item.key, { cantidad: item.cantidad + 1 })}
                        className="flex h-10 w-10 items-center justify-center text-lg font-medium text-ink-2"
                      >
                        +
                      </button>
                    </div>

                    {/* --- Precio editable ----------------------------------
                        Este campo es el corazón del requisito de "precios
                        variables": siempre está a la vista y siempre se puede
                        escribir encima, sin menús ni confirmaciones. */}
                    <label className="flex flex-1 items-center gap-1 rounded-lg border border-linea px-2.5 focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/25">
                      <span className="sr-only">Precio de {item.nombre}</span>
                      <span className="text-sm text-ink-3">$</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={10}
                        value={item.precio_unitario}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) =>
                          cambiar(item.key, {
                            precio_unitario: Math.max(0, Math.round(+e.target.value || 0)),
                          })
                        }
                        className="cifras h-10 w-full bg-transparent text-base font-semibold outline-none"
                      />
                      {item.precio_unitario !== item.precio_lista && (
                        <button
                          type="button"
                          onClick={() =>
                            cambiar(item.key, {
                              precio_unitario: item.precio_lista,
                              promocion_id: null,
                              promocion_nombre: null,
                            })
                          }
                          className="shrink-0 text-[11px] font-medium text-ink-3 underline"
                        >
                          {clp(item.precio_lista)}
                        </button>
                      )}
                    </label>
                  </div>

                  {/* --- Promociones -------------------------------------- */}
                  {editandoPromo === item.key ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => aplicarPromo(item, null)}
                        className="rounded-full border border-linea px-3 py-1.5 text-xs font-medium text-ink-2"
                      >
                        Sin promo
                      </button>
                      {promociones.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => aplicarPromo(item, p)}
                          className="rounded-full border border-marca-borde bg-marca-suave px-3 py-1.5 text-xs font-medium text-marca"
                        >
                          {p.nombre}{" "}
                          <span className="opacity-70">{etiquetaPromocion(p)}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditandoPromo(item.key)}
                      className="mt-2 text-xs font-medium text-marca underline"
                    >
                      {item.promocion_nombre ? "Cambiar promoción" : "Aplicar promoción"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* --- Medio de pago --------------------------------------------- */}
          <Grupo titulo="Medio de pago">
            {METODOS_PAGO.map((m) => (
              <Chip
                key={m}
                activo={metodoPago === m}
                onClick={() => setMetodoPago(m)}
                texto={ETIQUETAS_PAGO[m]}
              />
            ))}
          </Grupo>

          {/* --- Canal ----------------------------------------------------- */}
          <Grupo titulo="¿Dónde se vendió?">
            {CANALES.map((c) => (
              <Chip
                key={c}
                activo={canal === c}
                onClick={() => setCanal(c)}
                texto={ETIQUETAS_CANAL[c]}
              />
            ))}
          </Grupo>

          {/* --- Clienta (opcional) ---------------------------------------- */}
          <Grupo titulo="Clienta (opcional)">
            <div className="w-full space-y-2">
              <select
                value={clienteId}
                onChange={(e) => {
                  setClienteId(e.target.value);
                  if (e.target.value) setClienteNuevo("");
                }}
                className="w-full rounded-xl border border-linea bg-plano px-3 py-3 text-base outline-none focus:border-marca"
              >
                <option value="">Sin registrar</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {!clienteId && (
                <input
                  type="text"
                  value={clienteNuevo}
                  onChange={(e) => setClienteNuevo(e.target.value)}
                  placeholder="…o escribí un nombre nuevo"
                  className="w-full rounded-xl border border-linea bg-plano px-3 py-3 text-base outline-none focus:border-marca"
                />
              )}
              <p className="text-xs text-ink-3">
                Anotar quién compró es lo que después permite ver quién vuelve y
                a quién vale la pena avisarle cuando llega algo nuevo.
              </p>
            </div>
          </Grupo>

          <Grupo titulo="Nota (opcional)">
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: pidió trasplante, pasa el viernes"
              className="w-full rounded-xl border border-linea bg-plano px-3 py-3 text-base outline-none focus:border-marca"
            />
          </Grupo>
        </div>

        {/* --- Pie fijo con el total y el botón --------------------------- */}
        <div className="pb-segura border-t border-linea px-4 pb-3 pt-3">
          <dl className="mb-3 space-y-1 text-sm">
            {descuento > 0 && (
              <>
                <div className="flex justify-between text-ink-2">
                  <dt>Precio de lista</dt>
                  <dd className="cifras">{clp(lista)}</dd>
                </div>
                <div className="flex justify-between text-marca">
                  <dt>Descuento</dt>
                  <dd className="cifras">−{clp(descuento)}</dd>
                </div>
              </>
            )}
            <div className="flex items-baseline justify-between">
              <dt className="font-semibold">Total</dt>
              <dd className="text-2xl font-bold">{clp(total)}</dd>
            </div>
          </dl>

          {error && (
            <p role="alert" className="mb-2 text-sm text-critico-texto">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={cobrar}
            disabled={guardando || carrito.length === 0}
            className="w-full rounded-xl bg-marca px-4 py-4 text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {guardando ? "Guardando…" : `Confirmar venta · ${clp(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Piezas chicas reutilizadas dentro de la hoja --------------------------

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
        {titulo}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({
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
      className={`min-h-11 rounded-full border px-4 text-sm font-medium transition ${
        activo ? "border-marca bg-marca text-white" : "border-linea bg-plano text-ink-2"
      }`}
    >
      {texto}
    </button>
  );
}
