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
    theme_color: "#15803d",
    lang: "es-CL",
    icons: [
      {
        // SVG inline como data URI: evita tener que generar y versionar PNGs
        // en varios tamaños para un ícono que es una sola planta.
        src:
          "data:image/svg+xml," +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
              '<rect width="100" height="100" rx="22" fill="#15803d"/>' +
              '<text x="50" y="50" font-size="58" text-anchor="middle" ' +
              'dominant-baseline="central">🪴</text>' +
              "</svg>",
          ),
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
