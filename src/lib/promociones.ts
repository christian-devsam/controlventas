import type { Promocion } from "./types";

/**
 * Calcula el precio unitario que sugiere una promoción.
 *
 * Ojo con lo que esto NO hace: no guarda la fórmula. La app calcula un precio
 * sugerido, Camila lo puede sobrescribir, y lo que se guarda en la venta es el
 * número final. La promoción queda sólo como etiqueta.
 *
 * Es a propósito: si el día de mañana se cambia el 10% a 15%, las ventas viejas
 * siguen diciendo lo que realmente se cobró. Si guardáramos la fórmula, el
 * historial se reescribiría solo.
 */
export function precioConPromocion(
  precioLista: number,
  promo: Promocion | null | undefined,
  cantidad = 1,
): number {
  if (!promo) return precioLista;

  switch (promo.tipo) {
    case "porcentaje":
      return Math.max(0, Math.round(precioLista * (1 - promo.valor / 100)));

    case "monto_fijo":
      return Math.max(0, precioLista - promo.valor);

    case "precio_fijo":
      return Math.max(0, promo.valor);

    case "pack":
      // `valor` es el precio del pack completo (ej: "3 suculentas x $5.000").
      // Lo repartimos entre las unidades para que el total cuadre.
      if (promo.valor > 0 && cantidad > 0) {
        return Math.max(0, Math.round(promo.valor / cantidad));
      }
      // Pack sin precio definido ("planta + macetero"): no adivinamos nada,
      // se escribe el precio a mano.
      return precioLista;

    default:
      return precioLista;
  }
}

/** Texto corto para el chip de la promoción. */
export function etiquetaPromocion(promo: Promocion): string {
  switch (promo.tipo) {
    case "porcentaje":
      return `−${promo.valor}%`;
    case "monto_fijo":
      return `−$${promo.valor.toLocaleString("es-CL")}`;
    case "precio_fijo":
      return `$${promo.valor.toLocaleString("es-CL")}`;
    case "pack":
      return promo.valor > 0 ? `Pack $${promo.valor.toLocaleString("es-CL")}` : "Pack";
    default:
      return promo.nombre;
  }
}
