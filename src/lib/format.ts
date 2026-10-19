/**
 * Formato de pesos chilenos: sin decimales, con punto de miles. `$12.990`.
 * El CLP no tiene centavos, así que todos los montos son enteros.
 */
const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function clp(monto: number | null | undefined): string {
  return CLP.format(monto ?? 0);
}

/** Igual que `clp` pero compacto, para ejes de gráficos: `$13k`. */
export function clpCorto(monto: number | null | undefined): string {
  const n = monto ?? 0;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export function numero(n: number | null | undefined): string {
  return new Intl.NumberFormat("es-CL").format(n ?? 0);
}

/** Fecha y hora en zona de Santiago: `19 oct, 14:32`. */
export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** `19 oct` — para los ejes de los gráficos. */
export function fechaCorta(iso: string): string {
  // Las vistas devuelven DATE (`2026-10-19`). Lo parseamos como fecha local
  // para que no se corra un día por la conversión a UTC.
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
  });
}

/** Quita acentos y pasa a minúsculas, para que el buscador sea tolerante. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // quita las tildes que deja NFD
    .toLowerCase()
    .trim();
}

/** Variación porcentual entre dos valores, para los indicadores del dashboard. */
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}
