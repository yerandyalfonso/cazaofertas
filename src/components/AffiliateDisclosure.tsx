export function AffiliateDisclosure({ className = "" }: { className?: string }) {
  return (
    <p
      className={
        className
          ? `text-xs leading-relaxed ${className}`
          : "text-xs leading-relaxed text-stone-500"
      }
    >
      Como Afiliados de Amazon, obtenemos ingresos por las compras adscritas
      que cumplen los requisitos aplicables. Algunos enlaces de producto pueden
      generar comisión <span className="opacity-90">sin coste extra</span> para
      ti. Los precios pueden cambiar en Amazon.
    </p>
  );
}
