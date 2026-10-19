/**
 * Tipos de la base de datos. Escritos a mano y a propósito: son pocos y así el
 * proyecto no depende de un paso de generación de código.
 *
 * Si crecen, se pueden generar con:
 *   npx supabase gen types typescript --project-id jjemflwxwmxgkfgelfed
 */

export type Categoria = string;

export type Planta = {
  id: string;
  nombre: string;
  categoria: Categoria;
  precio_base: number;
  costo: number | null;
  stock: number;
  stock_minimo: number;
  emoji: string | null;
  activa: boolean;
  creada_en: string;
  actualizada_en: string;
};

export type TipoPromocion = "porcentaje" | "monto_fijo" | "precio_fijo" | "pack";

export type Promocion = {
  id: string;
  nombre: string;
  tipo: TipoPromocion;
  valor: number;
  activa: boolean;
};

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  instagram: string | null;
  comuna: string | null;
  notas: string | null;
};

export const CANALES = ["tienda", "web", "whatsapp", "instagram", "feria"] as const;
export type Canal = (typeof CANALES)[number];

export const METODOS_PAGO = ["efectivo", "transferencia", "debito", "credito", "otro"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const ETIQUETAS_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  otro: "Otro",
};

export const ETIQUETAS_CANAL: Record<Canal, string> = {
  tienda: "Tienda",
  web: "Web",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  feria: "Feria",
};

export type Venta = {
  id: string;
  folio: number;
  fecha: string;
  cliente_id: string | null;
  canal: Canal;
  metodo_pago: MetodoPago;
  subtotal: number;
  descuento_total: number;
  total: number;
  notas: string | null;
};

export type VentaItem = {
  id: string;
  venta_id: string;
  planta_id: string | null;
  nombre_planta: string;
  cantidad: number;
  precio_unitario: number;
  precio_lista: number;
  promocion_id: string | null;
  subtotal: number;
};

/** Venta con sus líneas y la clienta, como la devuelve el historial. */
export type VentaDetalle = Venta & {
  venta_items: VentaItem[];
  clientes: Pick<Cliente, "id" | "nombre"> | null;
};

// --- Línea del carrito, antes de guardarse -------------------------------
export type ItemCarrito = {
  /** Identificador local de la línea; no es el id de la base. */
  key: string;
  planta_id: string;
  nombre: string;
  emoji: string | null;
  cantidad: number;
  /** Precio efectivo. Arranca en el de lista y se puede editar. */
  precio_unitario: number;
  precio_lista: number;
  promocion_id: string | null;
  promocion_nombre: string | null;
  stock_disponible: number;
};

// --- Formas que devuelven las vistas analíticas --------------------------
export type KPIs = {
  ingresos_hoy: number;
  ventas_hoy: number;
  ingresos_mes: number;
  ventas_mes: number;
  descuentos_mes: number;
  ingresos_mes_pasado: number;
  ingresos_30d: number;
  ticket_promedio_30d: number;
};

export type VentaDia = {
  dia: string;
  ventas: number;
  unidades: number;
  ingresos: number;
  descuentos: number;
  ticket_promedio: number;
};

export type TopPlanta = {
  planta_id: string | null;
  nombre_planta: string;
  categoria: string;
  unidades: number;
  ingresos: number;
  precio_promedio: number;
  veces_vendida: number;
  descuento_promedio_pct: number;
  ultima_venta: string;
};

export type VentaCategoria = {
  categoria: string;
  unidades: number;
  ingresos: number;
};

export type VentaHora = {
  hora: number;
  ventas: number;
  ingresos: number;
};

export type VentaDiaSemana = {
  dia_num: number;
  dia_nombre: string;
  ventas: number;
  ingresos: number;
  ticket_promedio: number;
};

export type ImpactoPromocion = {
  promocion_id: string;
  nombre: string;
  tipo: TipoPromocion;
  ventas_con_promo: number;
  unidades: number;
  ingreso_generado: number | null;
  ingreso_resignado: number | null;
  precio_promedio: number | null;
};

export type ClienteTop = {
  cliente_id: string;
  nombre: string;
  telefono: string | null;
  compras: number;
  gasto_total: number;
  ticket_promedio: number;
  ultima_compra: string;
  dias_sin_comprar: number;
};

export type StockAlerta = {
  id: string;
  nombre: string;
  categoria: string;
  stock: number;
  stock_minimo: number;
  precio_base: number;
  vendidas_ultimos_30d: number;
  dias_de_stock_restante: number | null;
};
