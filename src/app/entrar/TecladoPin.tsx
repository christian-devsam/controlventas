"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { verificarPin } from "./acciones";

const LARGO = 4;

/**
 * Teclado numérico propio, en vez de un `<input>` con el teclado del sistema.
 *
 * Son cuatro dígitos: con el teclado nativo hay que esperar a que suba, tapa
 * media pantalla y los números quedan chicos arriba de todo. Botones grandes
 * abajo se tocan con el pulgar sin mirar.
 *
 * El envío sale del propio toque y NO de un `useEffect` que observe el largo
 * del PIN. Esa versión parecía más elegante y estaba rota: el efecto llamaba a
 * `setVerificando(true)`, `verificando` estaba en sus dependencias, el efecto
 * se volvía a disparar y su limpieza cancelaba la petición en vuelo. Resultado:
 * al primer PIN equivocado el teclado quedaba clavado en "Verificando…" para
 * siempre. Disparar desde el evento no tiene ese problema.
 */
export default function TecladoPin() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bloqueada, setBloqueada] = useState(false);

  /* El PIN vive también en un ref, y el ref es el que manda al escribir.
     `pin` (el estado) sólo existe para pintar los puntitos.

     Motivo: el estado de React no se actualiza hasta el siguiente render, así
     que dos toques muy seguidos leerían los dos el mismo valor viejo y el
     segundo dígito se perdería. El ref cambia en el acto. */
  const pinRef = useRef("");

  const limpiarPin = useCallback(() => {
    pinRef.current = "";
    setPin("");
  }, []);

  const enviar = useCallback(
    async (completo: string) => {
      setVerificando(true);
      setError(null);

      try {
        const r = await verificarPin(completo);

        if (r.ok) {
          // `refresh()` antes de navegar para que el proxy vea la cookie nueva;
          // sin esto la primera carga rebota de vuelta acá.
          router.refresh();
          router.replace("/vender");
          return; // se deja `verificando` en true: ya estamos navegando
        }

        setError(r.error);
        setBloqueada(Boolean(r.bloqueada));
        limpiarPin();
      } catch {
        // Si la Server Action falla (sin señal, servidor caído), esto es lo
        // que evita que el teclado quede muerto.
        setError("No hay conexión. Intentá de nuevo.");
        limpiarPin();
      } finally {
        setVerificando(false);
      }
    },
    [router, limpiarPin],
  );

  const agregarDigito = useCallback(
    (d: string) => {
      if (verificando || bloqueada) return;

      const nuevo = pinRef.current + d;
      if (nuevo.length > LARGO) return;

      pinRef.current = nuevo;
      setPin(nuevo);
      setError(null);

      if (nuevo.length === LARGO) void enviar(nuevo);
    },
    [verificando, bloqueada, enviar],
  );

  const borrar = useCallback(() => {
    if (verificando || bloqueada) return;
    pinRef.current = pinRef.current.slice(0, -1);
    setPin(pinRef.current);
  }, [verificando, bloqueada]);

  // Teclado físico: cómodo cuando se prueba desde el computador.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) agregarDigito(e.key);
      if (e.key === "Backspace") borrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [agregarDigito, borrar]);

  const inactivo = verificando || bloqueada;

  return (
    <div>
      {/* --- Los cuatro puntos ------------------------------------------- */}
      <div
        className="flex justify-center gap-4"
        role="status"
        aria-label={`${pin.length} de ${LARGO} dígitos escritos`}
      >
        {Array.from({ length: LARGO }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`h-3.5 w-3.5 rounded-full border-2 transition ${
              i < pin.length
                ? "border-marca bg-marca"
                : error
                  ? "border-critico"
                  : "border-eje"
            }`}
          />
        ))}
      </div>

      <p
        role="alert"
        /* Alto reservado siempre: si el mensaje apareciera y desapareciera,
           el teclado saltaría 20px hacia abajo justo cuando se vuelve a tocar. */
        className="mt-4 min-h-10 text-center text-sm text-critico-texto"
      >
        {error}
      </p>

      {/* --- Teclado ------------------------------------------------------ */}
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Tecla key={d} onClick={() => agregarDigito(d)} inactiva={inactivo}>
            {d}
          </Tecla>
        ))}

        <span />

        <Tecla onClick={() => agregarDigito("0")} inactiva={inactivo}>
          0
        </Tecla>

        <Tecla
          onClick={borrar}
          inactiva={inactivo || pin.length === 0}
          etiqueta="Borrar"
        >
          <span aria-hidden="true">⌫</span>
        </Tecla>
      </div>

      <p className="mt-6 text-center text-xs text-ink-3">
        {verificando
          ? "Verificando…"
          : bloqueada
            ? "Esperá 15 minutos antes de volver a probar."
            : "Se escribe una sola vez por teléfono."}
      </p>
    </div>
  );
}

function Tecla({
  children,
  onClick,
  inactiva,
  etiqueta,
}: {
  children: React.ReactNode;
  onClick: () => void;
  inactiva: boolean;
  etiqueta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={inactiva}
      aria-label={etiqueta}
      /* h-16: objetivo de toque bien por encima del mínimo de 44px, para poder
         escribir el PIN sin mirar. */
      className="flex h-16 items-center justify-center rounded-2xl border border-linea bg-superficie text-2xl font-medium transition active:scale-95 active:bg-marca-suave disabled:opacity-40"
    >
      {children}
    </button>
  );
}
