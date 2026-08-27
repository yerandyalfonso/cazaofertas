import { DealLevel } from "@/types";

const LEVEL_STYLES: Record<DealLevel, { label: string; className: string }> = {
  [DealLevel.NORMAL]: {
    label: "Oferta",
    className: "bg-stone-200 text-stone-700",
  },
  [DealLevel.GOOD_DEAL]: {
    label: "Buena oferta",
    className: "bg-teal-100 text-teal-900",
  },
  [DealLevel.GREAT_DEAL]: {
    label: "Gran oferta",
    className: "bg-amber-200 text-amber-950",
  },
  [DealLevel.HISTORICAL_LOW]: {
    label: "Chollazo",
    className: "bg-rose-200 text-rose-950",
  },
};

export type BadgeVariant = "deal" | "discount" | "neutral" | "category";

interface BadgeProps {
  children?: React.ReactNode;
  variant?: BadgeVariant;
  dealLevel?: DealLevel;
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  dealLevel,
  className = "",
}: BadgeProps) {
  if (dealLevel) {
    const style = LEVEL_STYLES[dealLevel];
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${style.className} ${className}`}
      >
        {children ?? style.label}
      </span>
    );
  }

  const variants: Record<BadgeVariant, string> = {
    deal: "bg-amber-200 text-amber-950",
    discount: "bg-ink text-paper",
    neutral: "bg-stone-200 text-stone-700",
    category: "bg-teal-900/10 text-teal-950",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
