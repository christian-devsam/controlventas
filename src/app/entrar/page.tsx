import Logo from "@/components/Logo";
import TecladoPin from "./TecladoPin";

export const metadata = { title: "Entrar · Plantas de Camila" };

export default function Entrar() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-xs">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo tamano={132} prioridad />
          <p className="mt-4 text-sm text-ink-2">Control de ventas · Puente Alto</p>
        </div>

        <TecladoPin />
      </div>
    </main>
  );
}
