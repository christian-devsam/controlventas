"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salir } from "@/app/entrar/acciones";

/**
 * Borra la cookie de sesión y vuelve a pedir el PIN.
 *
 * Pide confirmación porque es justo lo contrario de lo que se busca en el uso
 * diario: la gracia del PIN es escribirlo una vez y nunca más. Esto es para
 * cuando se presta el teléfono o se cambia de equipo.
 */
export default function BotonSalir() {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);

  if (confirmando) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={async () => {
            await salir();
            router.refresh();
            router.replace("/entrar");
          }}
          className="rounded-lg bg-critico px-2.5 py-1.5 text-xs font-semibold text-white"
        >
          Salir
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="rounded-lg border border-linea px-2.5 py-1.5 text-xs font-medium text-ink-2"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      aria-label="Cerrar sesión"
      className="rounded-lg border border-linea px-2.5 py-1.5 text-xs font-medium text-ink-3"
    >
      Salir
    </button>
  );
}
