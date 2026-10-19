"use client";

import { useMemo, useState } from "react";
import { clp, normalizar } from "@/lib/format";
import type { Planta } from "@/lib/types";
import FormularioPlanta from "./FormularioPlanta";
import ControlStock from "./ControlStock";

export default function Catalogo({ plantas }: { plantas: Planta[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Planta | "nueva" | null>(null);
  const [stockDe, setStockDe] = useState<Planta | null>(null);

  const categoriasExistentes = useMemo(
    () => Array.from(new Set(plantas.map((p) => p.categoria))).sort(),
    [plantas],
  );

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return plantas;
    return plantas.filter(
      (p) => normalizar(p.nombre).includes(q) || normalizar(p.categoria).includes(q),
    );
  }, [plantas, busqueda]);

  const porReponer = plantas.filter((p) => p.activa && p.stock <= p.stock_minimo);
  const valorInventario = plantas
    .filter((p) => p.activa)
    .reduce((s, p) => s + p.stock * p.precio_base, 0);

  return (
    <div className="px-4 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Plantas</h1>
          <p className="cifras mt-1 text-sm text-ink-2">
            {plantas.filter((p) => p.activa).length} activas · inventario a precio de
            venta {clp(valorInventario)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando("nueva")}
          className="shrink-0 rounded-xl bg-marca px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98]"
        >
          + Nueva
        </button>
      </div>

      {/* --- Aviso de reposición ------------------------------------------
          Arriba y a la vista: es la decisión más accionable de esta pantalla.
          Icono + texto, nunca sólo color. */}
      {porReponer.length > 0 && (
        <div className="mt-4 rounded-xl border border-grave/40 bg-grave/10 p-3">
          <p className="text-sm font-semibold">
            <span aria-hidden="true">⚠️ </span>
            Hay que reponer {porReponer.length}{" "}
            {porReponer.length === 1 ? "planta" : "plantas"}
          </p>
          <p className="mt-1 text-xs text-ink-2">
            {porReponer
              .slice(0, 6)
              .map((p) => `${p.nombre} (${p.stock})`)
              .join(" · ")}
            {porReponer.length > 6 && ` y ${porReponer.length - 6} más`}
          </p>
        </div>
      )}

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar en el catálogo…"
        aria-label="Buscar en el catálogo"
        className="mt-4 w-full rounded-xl border border-linea bg-superficie px-4 py-3 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/25"
      />

      <ul className="mt-3 space-y-2">
        {visibles.map((p) => (
          <li
            key={p.id}
            className={`tarjeta flex items-center gap-3 p-3 ${p.activa ? "" : "opacity-55"}`}
          >
            <span className="text-2xl leading-none" aria-hidden="true">
              {p.emoji ?? "🪴"}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {p.nombre}
                {!p.activa && (
                  <span className="ml-2 rounded bg-plano px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-3">
                    oculta
                  </span>
                )}
              </p>
              <p className="cifras mt-0.5 text-xs text-ink-3">
                {p.categoria} · {clp(p.precio_base)}
                {p.costo ? ` · costo ${clp(p.costo)}` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStockDe(p)}
              className={`cifras shrink-0 rounded-lg border px-3 py-2 text-center text-sm font-semibold ${
                p.stock <= 0
                  ? "border-critico/40 bg-critico/10 text-critico-texto"
                  : p.stock <= p.stock_minimo
                    ? "border-grave/40 bg-grave/10 text-ink"
                    : "border-linea text-ink-2"
              }`}
            >
              {p.stock}
              <span className="block text-[10px] font-normal uppercase tracking-wide opacity-70">
                stock
              </span>
            </button>

            <button
              type="button"
              onClick={() => setEditando(p)}
              aria-label={`Editar ${p.nombre}`}
              className="shrink-0 rounded-lg border border-linea px-3 py-2 text-sm"
            >
              ✏️
            </button>
          </li>
        ))}
      </ul>

      {visibles.length === 0 && (
        <p className="py-12 text-center text-sm text-ink-3">
          Nada coincide con “{busqueda}”.
        </p>
      )}

      {editando && (
        <FormularioPlanta
          planta={editando === "nueva" ? null : editando}
          categorias={categoriasExistentes}
          onCerrar={() => setEditando(null)}
        />
      )}

      {stockDe && <ControlStock planta={stockDe} onCerrar={() => setStockDe(null)} />}
    </div>
  );
}
