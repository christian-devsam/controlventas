import fs from "node:fs";
import path from "node:path";
import Image from "next/image";

/**
 * Logo de Plantas de Camila.
 *
 * Busca `public/logo.png`. Si todavía no está, dibuja un emblema de reserva en
 * SVG con los mismos colores de la marca, para que la app no se vea rota
 * mientras tanto.
 *
 * La comprobación corre en el servidor al renderizar, no en cada request del
 * navegador, así que no cuesta nada.
 */
const HAY_LOGO = (() => {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", "logo.png"));
  } catch {
    return false;
  }
})();

export default function Logo({
  tamano = 120,
  prioridad = false,
}: {
  tamano?: number;
  prioridad?: boolean;
}) {
  if (HAY_LOGO) {
    return (
      <Image
        src="/logo.png"
        alt="Plantas de Camila"
        width={tamano}
        height={tamano}
        priority={prioridad}
        className="h-auto rounded-2xl"
        style={{ width: tamano }}
      />
    );
  }

  return <EmblemaDeReserva tamano={tamano} />;
}

/** Emblema dibujado: círculo rosado, planta y el nombre en curva. */
function EmblemaDeReserva({ tamano }: { tamano: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 200 200"
      role="img"
      aria-label="Plantas de Camila"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <path
          id="curva-nombre"
          d="M 100,100 m -72,0 a 72,72 0 1,1 144,0"
          fill="none"
        />
      </defs>

      <circle cx="100" cy="100" r="96" fill="var(--marca)" />
      <circle cx="100" cy="100" r="84" fill="var(--superficie)" />
      <circle
        cx="100"
        cy="100"
        r="84"
        fill="none"
        stroke="var(--marca)"
        strokeWidth="1.5"
        opacity="0.45"
      />

      {/* Perlas del aro, como en el logo original. */}
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={100 + Math.cos(a) * 90}
            cy={100 + Math.sin(a) * 90}
            r="3.4"
            fill="#ffffff"
            opacity="0.92"
          />
        );
      })}

      <text fontSize="19" fontWeight="700" fill="var(--marca)" letterSpacing="0.5">
        <textPath href="#curva-nombre" startOffset="50%" textAnchor="middle">
          plantasdecamila
        </textPath>
      </text>

      {/* Maceta y hojas */}
      <g transform="translate(100 112)">
        <path
          d="M -17 6 L 17 6 L 13 30 Q 13 33 10 33 L -10 33 Q -13 33 -13 30 Z"
          fill="#e9b7bd"
        />
        <ellipse cx="0" cy="6" rx="17" ry="3.4" fill="#d79aa3" />
        <g fill="#2f6b35">
          <ellipse cx="0" cy="-18" rx="9" ry="17" />
          <ellipse cx="-16" cy="-8" rx="8" ry="15" transform="rotate(-34 -16 -8)" />
          <ellipse cx="16" cy="-8" rx="8" ry="15" transform="rotate(34 16 -8)" />
          <ellipse cx="-9" cy="-26" rx="6.5" ry="12" transform="rotate(-20 -9 -26)" />
          <ellipse cx="9" cy="-26" rx="6.5" ry="12" transform="rotate(20 9 -26)" />
        </g>
        <path d="M 0 4 L 0 -30" stroke="#24542a" strokeWidth="2.2" fill="none" />
      </g>

      <text
        x="100"
        y="168"
        textAnchor="middle"
        fontSize="11.5"
        fontWeight="600"
        fill="#1f5c2a"
      >
        Tu espacio verde favorito
      </text>
    </svg>
  );
}
