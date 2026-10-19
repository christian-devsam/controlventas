import { redirect } from "next/navigation";

/**
 * La raíz manda directo a registrar una venta.
 *
 * Es la pantalla que se abre 20 veces al día; el dashboard se mira una vez.
 * Abrir en "Vender" ahorra un toque en el 95% de los usos.
 */
export default function Home() {
  redirect("/vender");
}
