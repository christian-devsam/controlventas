import { Suspense } from "react";
import FormularioLogin from "./FormularioLogin";

export const metadata = { title: "Entrar · Plantas de Camila" };

/**
 * El formulario lee `?volver=` y `?error=` con `useSearchParams`, que obliga a
 * Next a esperar al cliente para saber qué renderizar. El `Suspense` es lo que
 * le permite servir el armazón de la página al instante y rellenar el
 * formulario cuando llega: sin él, la build falla al prerenderizar.
 */
export default function Login() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mb-3 text-5xl" aria-hidden="true">
            🪴
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Plantas de Camila</h1>
          <p className="mt-1 text-sm text-ink-2">Control de ventas · Puente Alto</p>
        </div>

        <Suspense
          fallback={
            <div className="tarjeta h-48 animate-pulse p-5" aria-hidden="true" />
          }
        >
          <FormularioLogin />
        </Suspense>
      </div>
    </main>
  );
}
