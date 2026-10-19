"use client";

import { useEffect } from "react";

/**
 * Hoja que sube desde abajo. La usan todos los formularios de la app.
 *
 * En un teléfono, un modal centrado deja los botones lejos del pulgar y el
 * teclado lo tapa a medias. Una hoja anclada abajo no tiene ninguno de los dos
 * problemas.
 */
export default function Hoja({
  titulo,
  onCerrar,
  children,
  pie,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
  pie?: React.ReactNode;
}) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);

    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = previo;
    };
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="relative mx-auto flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-superficie"
      >
        <div className="flex items-center justify-between border-b border-linea px-4 py-3">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="-m-2 p-2 text-lg text-ink-3"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>

        {pie && (
          <div className="pb-segura border-t border-linea px-4 pb-3 pt-3">{pie}</div>
        )}
      </div>
    </div>
  );
}
