import BarraNav from "@/components/BarraNav";
import Cabecera from "@/components/Cabecera";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* El padding de abajo deja aire para la barra fija; sin esto, la última
          fila de cualquier lista queda tapada y no se puede tocar. */}
      <div className="mx-auto max-w-2xl pb-[calc(var(--espaciado-nav)+env(safe-area-inset-bottom,0px))]">
        <Cabecera />
        {children}
      </div>
      <BarraNav />
    </>
  );
}
