/** Formas que devuelven las funciones `panel_*` de Postgres (ver 0005_panel.sql). */

export type FilaKpis = {
  ingresos: number;
  ventas: number;
  unidades: number;
  descuentos: number;
  ticket_promedio: number;
  ingresos_previo: number;
  ventas_previo: number;
  ingresos_hoy: number;
  ventas_hoy: number;
  /** Plata que entró de verdad por caja en el período. */
  cobrado: number;
  /** Saldo abierto de todas las ventas en cuotas (no del período: total). */
  por_cobrar: number;
  vencido: number;
  utilidad: number;
  unidades_sin_costo: number;
};

export type FilaUtilidad = {
  nombre_planta: string;
  categoria: string;
  unidades: number;
  ingresos: number;
  costo_total: number;
  utilidad: number;
  margen_pct: number;
  unidades_sin_costo: number;
};

export type FilaSerie = {
  dia: string;
  ingresos: number;
  ventas: number;
  unidades: number;
  ticket_promedio: number;
};

export type FilaTopPlanta = {
  nombre_planta: string;
  categoria: string;
  unidades: number;
  ingresos: number;
  precio_promedio: number;
  descuento_promedio_pct: number;
};

export type FilaCategoria = {
  categoria: string;
  unidades: number;
  ingresos: number;
};

export type FilaMapa = {
  dia_num: number;
  dia_nombre: string;
  bloque: number;
  bloque_nombre: string;
  ventas: number;
  ingresos: number;
};

export type FilaPromocion = {
  nombre: string;
  tipo: string;
  ventas_con_promo: number;
  unidades: number;
  ingreso_generado: number;
  ingreso_resignado: number;
};
