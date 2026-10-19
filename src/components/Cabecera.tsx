import Logo from "./Logo";
import BotonSalir from "./BotonSalir";

/**
 * Cabecera con el logo. Va en todas las pantallas de la app.
 *
 * No es decorativa: cuando la app está "agregada a la pantalla de inicio" no
 * hay barra de direcciones ni título de pestaña, así que sin esto no queda
 * nada que diga de qué app se trata.
 */
export default function Cabecera() {
  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-3">
      <div className="flex items-center gap-2.5">
        <Logo tamano={34} />
        <span className="text-sm font-semibold tracking-tight">Plantas de Camila</span>
      </div>
      <BotonSalir />
    </header>
  );
}
