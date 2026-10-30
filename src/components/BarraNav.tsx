"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const RUTAS = [
  { href: "/vender", etiqueta: "Vender", icono: "🛒" },
  { href: "/ventas", etiqueta: "Ventas", icono: "🧾" },
  { href: "/deudas", etiqueta: "Deudas", icono: "💰" },
  { href: "/plantas", etiqueta: "Plantas", icono: "🪴" },
  { href: "/dashboard", etiqueta: "Números", icono: "📈" },
] as const;

/**
 * Navegación fija abajo: en un teléfono, la parte de arriba de la pantalla
 * queda lejos del pulgar.
 *
 * Cinco destinos es el techo. En la pantalla más angosta que importa (375px)
 * cada uno queda en 75px de ancho y 56px de alto, todavía por encima del
 * mínimo de 44px para tocar sin errarle. Un sexto ya no entraría.
 */
export default function BarraNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="pb-segura fixed inset-x-0 bottom-0 z-40 border-t border-linea bg-superficie/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-2xl">
        {RUTAS.map((r) => {
          const activa = pathname.startsWith(r.href);
          return (
            <li key={r.href} className="flex-1">
              <Link
                href={r.href}
                aria-current={activa ? "page" : undefined}
                /* min-h-14: objetivo de toque cómodo, bien sobre los 44px
                   mínimos de las guías de accesibilidad. */
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition ${
                  activa ? "text-marca" : "text-ink-3"
                }`}
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  {r.icono}
                </span>
                {r.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
