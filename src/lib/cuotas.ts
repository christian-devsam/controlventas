/**
 * Cálculo del plan de cuotas para la vista previa de la pantalla de cobro.
 *
 * OJO: esto es un ESPEJO de lo que hace `registrar_venta` en Postgres
 * (0008_funciones_cuotas.sql). El plan que se guarda lo arma la base, no esta
 * función — acá sólo se muestra. Pero si los dos repartos no coinciden, la
 * vista previa diría "3 de $6.667" y la base guardaría otra cosa, que es la
 * clase de diferencia que destruye la confianza en el sistema.
 *
 * Por eso el reparto es idéntico: división entera y el resto se suma de a un
 * peso a las PRIMERAS cuotas.
 */
export type CuotaPlan = {
  numero: number;
  monto: number;
  vence: Date;
};

export function calcularPlan(
  total: number,
  cantidadCuotas: number,
  abonoInicial = 0,
  primerVence?: Date,
): CuotaPlan[] {
  if (cantidadCuotas < 2) return [];

  const abono = Math.max(0, Math.min(abonoInicial, total));
  const resto = total - abono;

  const base = Math.floor(resto / cantidadCuotas);
  const sobrante = resto % cantidadCuotas;

  const desde = primerVence ?? enUnMes(new Date());

  return Array.from({ length: cantidadCuotas }, (_, i) => ({
    numero: i + 1,
    // El resto se reparte de a un peso en las primeras cuotas, para que la
    // suma dé exactamente el saldo. Si no, quedaría un peso colgando y la
    // deuda nunca llegaría a cero.
    monto: base + (i < sobrante ? 1 : 0),
    vence: sumarMeses(desde, i),
  }));
}

/**
 * Suma meses cuidando los fines de mes.
 *
 * `setMonth` solo desborda: 31 de enero + 1 mes da 3 de marzo, porque febrero
 * no tiene 31. Para una cuota eso significa saltarse un mes entero. Acá, si el
 * día no existe en el mes destino, se usa el último día de ese mes.
 */
export function sumarMeses(fecha: Date, meses: number): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  d.setMonth(d.getMonth() + meses);

  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(fecha.getDate(), ultimoDia));

  return d;
}

export function enUnMes(desde: Date): Date {
  return sumarMeses(desde, 1);
}

/** `2026-11-30`, el formato que espera un <input type="date"> y Postgres. */
export function aISO(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Parsea `2026-11-30` como fecha LOCAL, no UTC (si no, se corre un día). */
export function desdeISO(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
}
