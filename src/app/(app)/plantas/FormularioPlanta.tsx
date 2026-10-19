"use client";

import { useState } from "react";
import Hoja from "@/components/Hoja";
import type { Planta } from "@/lib/types";
import { cambiarActiva, guardarPlanta } from "./acciones";

const EMOJIS = ["🪴", "🌿", "🌱", "🌵", "🍃", "💐", "🌾", "🎍", "💜", "🏺", "🪣", "💧"];

export default function FormularioPlanta({
  planta,
  categorias,
  onCerrar,
}: {
  planta: Planta | null;
  categorias: string[];
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(planta?.nombre ?? "");
  const [categoria, setCategoria] = useState(planta?.categoria ?? categorias[0] ?? "Otras");
  const [precio, setPrecio] = useState(String(planta?.precio_base ?? ""));
  const [costo, setCosto] = useState(planta?.costo != null ? String(planta.costo) : "");
  const [stockMinimo, setStockMinimo] = useState(String(planta?.stock_minimo ?? 3));
  const [stockInicial, setStockInicial] = useState("");
  const [emoji, setEmoji] = useState(planta?.emoji ?? "🪴");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);

    const r = await guardarPlanta({
      id: planta?.id,
      nombre,
      categoria,
      precio_base: Number(precio),
      costo: costo.trim() === "" ? null : Number(costo),
      stock_minimo: Number(stockMinimo) || 0,
      emoji,
      stock_inicial: planta ? undefined : Number(stockInicial) || 0,
    });

    if (!r.ok) {
      setGuardando(false);
      setError(r.error);
      return;
    }
    onCerrar();
  }

  async function alternarVisibilidad() {
    if (!planta) return;
    setGuardando(true);
    const r = await cambiarActiva(planta.id, !planta.activa);
    if (!r.ok) {
      setGuardando(false);
      setError(r.error);
      return;
    }
    onCerrar();
  }

  const margen =
    precio && costo && Number(costo) > 0
      ? Math.round(((Number(precio) - Number(costo)) / Number(precio)) * 100)
      : null;

  return (
    <Hoja
      titulo={planta ? planta.nombre : "Nueva planta"}
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
            disabled={guardando || !nombre.trim() || precio === ""}
            className="w-full rounded-xl bg-marca px-4 py-3.5 text-base font-semibold text-white active:scale-[0.98] disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Campo etiqueta="Nombre">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus={!planta}
            placeholder="Ej: Monstera deliciosa"
            className={estiloInput}
          />
        </Campo>

        <Campo etiqueta="Categoría">
          <input
            type="text"
            list="categorias-existentes"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Interior, Suculentas, Exterior…"
            className={estiloInput}
          />
          <datalist id="categorias-existentes">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Precio de venta">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={10}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="0"
              className={`cifras ${estiloInput}`}
            />
          </Campo>
          <Campo etiqueta="Costo (opcional)">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={10}
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              placeholder="0"
              className={`cifras ${estiloInput}`}
            />
          </Campo>
        </div>

        {margen !== null && (
          <p className="-mt-1 text-xs text-ink-2">
            Margen: <span className="cifras font-semibold">{margen}%</span> — anotar el
            costo es lo que después deja ver qué planta deja plata de verdad, no sólo
            cuál vende más.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Campo
            etiqueta="Avisar cuando queden"
            ayuda="Debajo de esta cantidad aparece el aviso de reposición."
          >
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
              className={`cifras ${estiloInput}`}
            />
          </Campo>

          {!planta && (
            <Campo etiqueta="Stock inicial">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={stockInicial}
                onChange={(e) => setStockInicial(e.target.value)}
                placeholder="0"
                className={`cifras ${estiloInput}`}
              />
            </Campo>
          )}
        </div>

        <Campo etiqueta="Ícono">
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
                aria-label={`Ícono ${e}`}
                className={`flex h-11 w-11 items-center justify-center rounded-lg border text-xl ${
                  emoji === e ? "border-marca bg-marca-suave" : "border-linea"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </Campo>

        {planta && (
          <div className="border-t border-linea pt-4">
            <button
              type="button"
              onClick={alternarVisibilidad}
              disabled={guardando}
              className="text-sm font-medium text-ink-2 underline"
            >
              {planta.activa
                ? "Ocultar de la pantalla de venta"
                : "Volver a mostrar en la pantalla de venta"}
            </button>
            <p className="mt-1.5 text-xs text-ink-3">
              Ocultar no borra nada: las ventas viejas y los gráficos siguen
              intactos. Es para lo que dejaste de traer.
            </p>
          </div>
        )}
      </div>
    </Hoja>
  );
}

const estiloInput =
  "w-full rounded-xl border border-linea bg-plano px-3 py-3 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/25";

function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-ink-3">{ayuda}</span>}
    </label>
  );
}
