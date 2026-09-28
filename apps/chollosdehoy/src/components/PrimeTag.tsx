/** Etiqueta «Prime»: el precio es una oferta solo para clientes Prime. */
export function PrimeTag({ className = "" }: { className?: string }) {
  return (
    <span
      title="Precio de oferta para clientes Prime"
      className={`inline-flex items-center rounded-control border border-accent px-1.5 py-0.5 text-[0.6875rem] font-bold leading-none text-accent ${className}`}
    >
      Prime
    </span>
  );
}
