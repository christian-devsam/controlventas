import { createClient } from "@/lib/supabase/server";
import type { ClienteTop, StockAlerta } from "@/lib/types";
import SelectorPeriodo from "./SelectorPeriodo";
import FilaKPIs from "./FilaKPIs";
import GraficoIngresos from "./GraficoIngresos";
import GraficoTopPlantas from "./GraficoTopPlantas";
import GraficoCategorias from "./GraficoCategorias";
import MapaHorario from "./MapaHorario";
import TablaPromociones from "./TablaPromociones";
import EstadoActual from "./EstadoActual";
import type {
  FilaCategoria,
  FilaKpis,
  FilaMapa,
  FilaPromocion,
  FilaSerie,
  FilaTopPlanta,
} from "./tipos";

export const metadata = { title: "Números · Plantas de Camila" };

const PERIODOS_VALIDOS = [7, 30, 90] as const;

export default async function PaginaDashboard({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { dias: diasParam } = await searchParams;
  const pedido = Number(diasParam);
  // Se valida contra una lista cerrada: el parámetro viene de la URL y no hay
  // razón para pasarle a la base un número arbitrario.
  const dias = (PERIODOS_VALIDOS as readonly number[]).includes(pedido) ? pedido : 30;

  const supabase = await createClient();

  // Ocho consultas en paralelo. Encadenadas serían ocho viajes de ida y vuelta
  // al servidor; así es uno solo (el más lento).
  const [kpis, serie, topPlantas, categorias, mapa, promos, reponer, clientas, catalogo] =
    await Promise.all([
      supabase.rpc("panel_kpis", { p_dias: dias }).single<FilaKpis>(),
      supabase.rpc("panel_serie_diaria", { p_dias: dias }),
      supabase.rpc("panel_top_plantas", { p_dias: dias, p_limite: 8 }),
      supabase.rpc("panel_categorias", { p_dias: dias }),
      supabase.rpc("panel_mapa_horario", { p_dias: 90 }),
      supabase.rpc("panel_promociones", { p_dias: dias }),
      supabase.from("v_stock_alerta").select("*").limit(10),
      supabase.from("v_clientes_top").select("*").limit(8),
      supabase.from("plantas").select("categoria"),
    ]);

  const errores = [kpis, serie, topPlantas, categorias, mapa, promos]
    .map((r) => r.error?.message)
    .filter(Boolean);

  if (errores.length) {
    return (
      <div className="p-4">
        <div className="tarjeta p-5 text-sm">
          <p className="font-semibold">No se pudieron calcular los números</p>
          <p className="mt-2 text-ink-2">
            Lo más probable es que falte aplicar las migraciones{" "}
            <code>0004_funciones.sql</code> y <code>0005_panel.sql</code> en el editor
            SQL de Supabase.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-ink-3">
            {errores.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  /* El mapeo categoría → color se construye desde TODO el catálogo en orden
     alfabético, no desde el ranking del período. Es deliberado: si el color
     saliera del ranking, cambiar de 30 a 7 días repintaría las categorías y
     quien ya aprendió "Suculentas es verde" quedaría leyendo otra cosa. */
  const todasLasCategorias = Array.from(
    new Set((catalogo.data ?? []).map((p: { categoria: string }) => p.categoria)),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const serieDatos = (serie.data ?? []) as FilaSerie[];
  const hayVentas = (kpis.data?.ventas ?? 0) > 0;

  return (
    <div className="px-4 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Números</h1>
      </div>

      {/* Un único selector arriba, que gobierna todo lo que hay debajo. Si cada
          tarjeta tuviera su propio filtro, dos gráficos lado a lado podrían
          estar mostrando períodos distintos sin que se note. */}
      <SelectorPeriodo dias={dias} />

      <FilaKPIs kpis={kpis.data!} dias={dias} />

      {!hayVentas ? (
        <div className="tarjeta mt-4 p-8 text-center">
          <p className="text-3xl" aria-hidden="true">
            📈
          </p>
          <p className="mt-2 text-sm font-medium">
            Todavía no hay ventas en estos {dias} días
          </p>
          <p className="mt-1 text-sm text-ink-3">
            Los gráficos aparecen solos en cuanto registres la primera.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <GraficoIngresos datos={serieDatos} dias={dias} />
          <GraficoTopPlantas datos={(topPlantas.data ?? []) as FilaTopPlanta[]} />
          <GraficoCategorias
            datos={(categorias.data ?? []) as FilaCategoria[]}
            ordenCategorias={todasLasCategorias}
          />
          <MapaHorario datos={(mapa.data ?? []) as FilaMapa[]} />
          <TablaPromociones datos={(promos.data ?? []) as FilaPromocion[]} />
        </div>
      )}

      {/* Estado actual: no depende del período elegido, y por eso va en su
          propia sección rotulada. Mezclarlo arriba haría creer que el selector
          también lo afecta. */}
      <EstadoActual
        reponer={(reponer.data ?? []) as StockAlerta[]}
        clientas={(clientas.data ?? []) as ClienteTop[]}
      />
    </div>
  );
}
