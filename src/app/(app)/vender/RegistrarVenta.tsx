"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clp, normalizar } from "@/lib/format";
import type { Cliente, ItemCarrito, Planta, Promocion } from "@/lib/types";
import HojaCobro from "./HojaCobro";

type Props = {
  plantas: Planta[];
  promociones: Promocion[];
  clientes: Pick<Cliente, "id" | "nombre" | "telefono">[];
};

const TODAS = "Todas";

export default function RegistrarVenta({ plantas, promociones, clientes }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string>(TODAS);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [cobrando, setCobrando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const temporizadorAviso = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpiar el temporizador al desmontar, para no llamar a setState sobre un
  // componente que ya no está en pantalla.
  useEffect(() => {
    return () => {
      if (temporizadorAviso.current) clearTimeout(temporizadorAviso.current);
    };
  }, []);

  const categorias = useMemo(
    () => [TODAS, ...Array.from(new Set(plantas.map((p) => p.categoria)))],
    [plantas],
  );

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    return plantas.filter((p) => {
      if (categoria !== TODAS && p.categoria !== categoria) return false;
      if (!q) return true;
      return normalizar(p.nombre).includes(q) || normalizar(p.categoria).includes(q);
    });
  }, [plantas, busqueda, categoria]);

  const total = carrito.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const unidades = carrito.reduce((s, i) => s + i.cantidad, 0);

  /** Tocar una planta la agrega; tocarla de nuevo sube la cantidad. */
  function agregar(p: Planta) {
    setCarrito((actual) => {
      const i = actual.findIndex((x) => x.planta_id === p.id && !x.promocion_id);
      if (i >= 0) {
        const copia = [...actual];
        copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 };
        return copia;
      }
      return [
        ...actual,
        {
          key: `${p.id}-${Date.now()}`,
          planta_id: p.id,
          nombre: p.nombre,
          emoji: p.emoji,
          cantidad: 1,
          precio_unitario: p.precio_base,
          precio_lista: p.precio_base,
          promocion_id: null,
          promocion_nombre: null,
          stock_disponible: p.stock,
        },
      ];
    });
  }

  function alCobrar(folio: number, montoCobrado: number) {
    setCarrito([]);
    setCobrando(false);
    setBusqueda("");
    setConfirmacion(`Venta #${folio} guardada · ${clp(montoCobrado)}`);
    // El aviso se va solo: no hay que tocar nada para seguir vendiendo.
    if (temporizadorAviso.current) clearTimeout(temporizadorAviso.current);
    temporizadorAviso.current = setTimeout(() => setConfirmacion(null), 3500);
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="sr-only">Registrar una venta</h1>

      {/* --- Buscador ------------------------------------------------------ */}
      <div className="sticky top-0 z-20 -mx-4 bg-plano/95 px-4 pb-2 pt-1 backdrop-blur">
        <div className="relative">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar planta…"
            aria-label="Buscar planta"
            /* text-base (16px) a propósito: con menos, iOS hace zoom al
               enfocar y descuadra toda la pantalla. */
            className="w-full rounded-xl border border-linea bg-superficie py-3 pl-10 pr-4 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/25"
          />
          <span
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
            aria-hidden="true"
          >
            🔍
          </span>
        </div>

        {/* --- Filtro por categoría --------------------------------------- */}
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={categoria === c}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                categoria === c
                  ? "border-marca bg-marca text-white"
                  : "border-linea bg-superficie text-ink-2"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* --- Grilla de plantas -------------------------------------------- */}
      {visibles.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">
          Ninguna planta coincide con “{busqueda}”.
        </p>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {visibles.map((p) => {
            const enCarrito = carrito
              .filter((i) => i.planta_id === p.id)
              .reduce((s, i) => s + i.cantidad, 0);
            const sinStock = p.stock <= 0;

            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => agregar(p)}
                  className={`relative flex h-full w-full flex-col items-start gap-1 rounded-xl border p-3 text-left transition active:scale-[0.97] ${
                    enCarrito
                      ? "border-marca bg-marca-suave"
                      : "border-linea bg-superficie"
                  }`}
                >
                  {enCarrito > 0 && (
                    <span className="cifras absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-marca px-1.5 text-xs font-bold text-white">
                      {enCarrito}
                    </span>
                  )}

                  <span className="text-2xl leading-none" aria-hidden="true">
                    {p.emoji ?? "🪴"}
                  </span>

                  <span className="line-clamp-2 min-h-10 text-sm font-medium leading-tight">
                    {p.nombre}
                  </span>

                  <span className="cifras text-sm font-semibold text-ink">
                    {clp(p.precio_base)}
                  </span>

                  {/* El stock usa color + texto, nunca color solo: así se lee
                      igual con daltonismo o en pantalla a pleno sol. */}
                  <span
                    className={`cifras text-[11px] font-medium ${
                      sinStock
                        ? "text-critico-texto"
                        : p.stock <= p.stock_minimo
                          ? "text-grave"
                          : "text-ink-3"
                    }`}
                  >
                    {sinStock
                      ? "Sin stock"
                      : p.stock <= p.stock_minimo
                        ? `¡Quedan ${p.stock}!`
                        : `${p.stock} en stock`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* --- Aviso de venta guardada -------------------------------------- */}
      {confirmacion && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-4 z-50 mx-auto max-w-md rounded-xl bg-marca px-4 py-3 text-center text-sm font-semibold text-white shadow-lg"
          style={{ bottom: "calc(var(--espaciado-nav) + 1rem)" }}
        >
          ✓ {confirmacion}
        </div>
      )}

      {/* --- Barra del carrito -------------------------------------------- */}
      {carrito.length > 0 && !cobrando && (
        <div
          className="fixed inset-x-0 z-30 px-4"
          style={{ bottom: "calc(var(--espaciado-nav) + 0.5rem)" }}
        >
          <button
            type="button"
            onClick={() => setCobrando(true)}
            className="mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-marca px-5 py-4 text-white shadow-lg transition active:scale-[0.98]"
          >
            <span className="cifras text-sm font-medium opacity-90">
              {unidades} {unidades === 1 ? "planta" : "plantas"}
            </span>
            <span className="text-lg font-bold">Cobrar {clp(total)}</span>
          </button>
        </div>
      )}

      {cobrando && (
        <HojaCobro
          carrito={carrito}
          setCarrito={setCarrito}
          promociones={promociones}
          clientes={clientes}
          onCerrar={() => setCobrando(false)}
          onGuardada={alCobrar}
        />
      )}
    </div>
  );
}
