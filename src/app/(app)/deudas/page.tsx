import { createClient } from "@/lib/supabase/server";
import { clp } from "@/lib/format";
import type { ClienteDeuda, Deuda } from "@/lib/types";
import ListaDeudas from "./ListaDeudas";

export const metadata = { title: "Deudas · Plantas de Camila" };
export const dynamic = "force-dynamic";

export default async function PaginaDeudas() {
  const supabase = await createClient();

  const [porVenta, porCliente] = await Promise.all([
    supabase.from("v_deudas").select("*"),
    supabase.from("v_clientes_deuda").select("*"),
  ]);

  if (porVenta.error || porCliente.error) {
    return (
      <div className="p-4">
        <div className="tarjeta p-5 text-sm">
          <p className="font-semibold">No se pudieron cargar las deudas</p>
          <p className="mt-2 text-ink-2">
            Probablemente falte aplicar <code>0007_cuotas_y_utilidad.sql</code> y{" "}
            <code>0008_funciones_cuotas.sql</code> en el editor SQL de Supabase.
          </p>
          <p className="mt-3 text-xs text-ink-3">
            {porVenta.error?.message ?? porCliente.error?.message}
          </p>
        </div>
      </div>
    );
  }

  const deudas = (porVenta.data ?? []) as Deuda[];
  const clientes = (porCliente.data ?? []) as ClienteDeuda[];

  const total = clientes.reduce((s, c) => s + c.deuda_total, 0);
  const vencido = clientes.reduce((s, c) => s + c.vencido_total, 0);

  return (
    <div className="px-4 pt-4">
      <h1 className="text-xl font-semibold tracking-tight">Deudas</h1>

      {clientes.length === 0 ? (
        <div className="tarjeta mt-4 p-8 text-center">
          <p className="text-3xl" aria-hidden="true">
            👌
          </p>
          <p className="mt-2 text-sm font-medium">Nadie te debe nada</p>
          <p className="mt-1 text-sm text-ink-3">
            Cuando vendas en cuotas, acá vas a ver quién debe y cuánto.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="tarjeta p-3.5">
              <p className="text-xs text-ink-2">Por cobrar</p>
              <p className="mt-1 text-xl font-semibold">{clp(total)}</p>
              <p className="mt-0.5 text-[11px] text-ink-3">
                {clientes.length} {clientes.length === 1 ? "clienta" : "clientas"}
              </p>
            </div>
            <div
              className={`tarjeta p-3.5 ${vencido > 0 ? "border-critico/40" : ""}`}
            >
              <p className="text-xs text-ink-2">Vencido</p>
              <p
                className={`mt-1 text-xl font-semibold ${
                  vencido > 0 ? "text-critico-texto" : ""
                }`}
              >
                {clp(vencido)}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-3">
                {vencido > 0 ? "hay que salir a cobrar" : "todo al día"}
              </p>
            </div>
          </div>

          <ListaDeudas clientes={clientes} deudas={deudas} />
        </>
      )}
    </div>
  );
}
