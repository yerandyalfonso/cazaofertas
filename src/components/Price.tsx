import { formatEuro } from "@/lib/money";

interface PriceProps {
  current: number;
  previous?: number | null;
  discountPercentage?: number | null;
  /** When false, keep strikethrough previous price but hide the −X% label. */
  showDiscountLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: {
    current: "text-lg",
    previous: "text-sm",
    discount: "text-xs",
  },
  md: {
    current: "text-2xl",
    previous: "text-base",
    discount: "text-sm",
  },
  lg: {
    current: "text-4xl md:text-5xl",
    previous: "text-xl",
    discount: "text-base",
  },
};

export function Price({
  current,
  previous,
  discountPercentage,
  showDiscountLabel = true,
  size = "md",
  className = "",
}: PriceProps) {
  const classes = sizeClasses[size];
  const hasPrevious =
    previous !== null && previous !== undefined && previous > current;

  return (
    <div className={`flex flex-wrap items-baseline gap-2 ${className}`}>
      <span
        className={`font-display font-semibold tracking-tight text-ink ${classes.current}`}
      >
        {formatEuro(current)}
      </span>
      {hasPrevious ? (
        <>
          <span
            className={`leading-none text-stone-500 line-through decoration-stone-400 ${classes.previous}`}
          >
            {formatEuro(previous)}
          </span>
          {showDiscountLabel &&
          discountPercentage !== null &&
          discountPercentage !== undefined &&
          discountPercentage > 0 ? (
            <span className={`font-semibold text-amber-800 ${classes.discount}`}>
              −{Math.round(discountPercentage)}%
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
