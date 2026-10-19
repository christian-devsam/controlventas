import type { MetadataRoute } from "next";

/**
 * Manifest para poder "agregar a la pantalla de inicio".
 *
 * Con esto la app se abre a pantalla completa, sin la barra de direcciones del
 * navegador, y se ve como una app cualquiera del teléfono. No es cosmético:
 * son unos 60px de alto recuperados en una pantalla donde todo compite por
 * espacio, y un toque menos para abrirla.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plantas de Camila",
    short_name: "Plantas",
    description: "Control de ventas",
    start_url: "/vender",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f9f9f7",
    theme_color: "#d81b76",
    lang: "es-CL",
    icons: [
      {
        // Si guardaste `public/logo.png`, este es el ícono que usa el teléfono
        // al agregar la app a la pantalla de inicio.
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        // Reserva mientras no exista el PNG, e ícono de la pestaña.
        src: "/icono.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
