"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Login en dos pasos: correo → código de 6 dígitos.
 *
 * El código se escribe en la MISMA pestaña, y eso importa: en el teléfono, el
 * enlace del correo suele abrirse en otro navegador (el de Gmail), donde no
 * existe la cookie del flujo PKCE y el login falla. Con el código, nada de eso
 * puede pasar. El enlace del correo sigue funcionando como respaldo.
 */
export default function FormularioLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const volver = params.get("volver") ?? "/vender";

  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "enlace_invalido"
      ? "Ese enlace ya no sirve. Pedí un código nuevo."
      : params.get("error"),
  );

  async function pedirCodigo(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: correo.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?volver=${encodeURIComponent(volver)}`,
      },
    });

    setCargando(false);
    if (error) setError(error.message);
    else setPaso("codigo");
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: correo.trim(),
      token: codigo.trim(),
      type: "email",
    });

    if (error) {
      setCargando(false);
      setError("Ese código no es correcto o ya expiró.");
      return;
    }

    // `refresh()` fuerza a releer la cookie nueva antes de navegar; sin esto,
    // la primera carga puede rebotar de vuelta al login.
    router.refresh();
    router.replace(volver);
  }

  if (paso === "correo") {
    return (
      <form onSubmit={pedirCodigo} className="tarjeta space-y-4 p-5">
        <div>
          <label htmlFor="correo" className="mb-1.5 block text-sm font-medium">
            Tu correo
          </label>
          <input
            id="correo"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="camila@ejemplo.cl"
            className="w-full rounded-xl border border-linea bg-plano px-4 py-3 text-base outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-critico-texto">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-xl bg-marca px-4 py-3.5 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {cargando ? "Enviando…" : "Enviarme un código"}
        </button>

        <p className="text-center text-xs text-ink-3">
          Te llega un código de 6 dígitos al correo. No hay contraseña que recordar.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={verificar} className="tarjeta space-y-4 p-5">
      <div>
        <label htmlFor="codigo" className="mb-1.5 block text-sm font-medium">
          Código de 6 dígitos
        </label>
        <input
          id="codigo"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoFocus
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="cifras w-full rounded-xl border border-linea bg-plano px-4 py-3 text-center text-2xl tracking-[0.3em] outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
        />
        <p className="mt-2 text-xs text-ink-3">Enviado a {correo}</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-critico-texto">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando || codigo.length < 6}
        className="w-full rounded-xl bg-marca px-4 py-3.5 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {cargando ? "Entrando…" : "Entrar"}
      </button>

      <button
        type="button"
        onClick={() => {
          setPaso("correo");
          setCodigo("");
          setError(null);
        }}
        className="w-full py-1 text-center text-sm text-ink-2 underline"
      >
        Usar otro correo
      </button>
    </form>
  );
}
