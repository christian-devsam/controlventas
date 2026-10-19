import Image from "next/image";

/**
 * Logo de Plantas de Camila (`public/logo.png`).
 *
 * Hubo una versión de esto que comprobaba con `fs.existsSync` si el archivo
 * estaba y, si no, dibujaba un emblema de reserva. Funcionaba en local y
 * habría fallado en Vercel: ahí `public/` se sirve desde el CDN y no existe
 * en el sistema de archivos de la función serverless, así que la comprobación
 * habría dado `false` siempre y nunca se habría visto el logo real.
 *
 * Ahora el archivo vive en el repo, así que no hay nada que comprobar.
 *
 * `next/image` se encarga de servirlo en el tamaño justo y en WebP: el
 * original pesa 2,7 MB, pero al teléfono le llegan unos pocos KB.
 */
export default function Logo({
  tamano = 120,
  prioridad = false,
}: {
  tamano?: number;
  prioridad?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Plantas de Camila"
      width={tamano}
      height={tamano}
      priority={prioridad}
      className="rounded-2xl"
    />
  );
}
