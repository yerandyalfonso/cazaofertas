"use client";

import { useState } from "react";

/** Tramos del slider: más finos en precios bajos, donde están casi todas las ofertas. */
const STOPS = [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 300, 500, 750, 1000];
const LAST = STOPS.length; // índice extra = «sin límite»

function toIndex(value: number | null, fallback: number): number {
  if (value === null) return fallback;
  const i = STOPS.findIndex((stop) => stop >= value);
  return i === -1 ? LAST : i;
}

interface PriceRangeSliderProps {
  min: number | null;
  max: number | null;
  onCommit: (min: number | null, max: number | null) => void;
}

/** Slider de precio con dos tiradores; aplica el filtro al soltar. */
export function PriceRangeSlider({ min, max, onCommit }: PriceRangeSliderProps) {
  // Borrador mientras se arrastra; si no, manda el filtro (así «Limpiar» lo resetea).
  const [draft, setDraft] = useState<{ lo: number; hi: number } | null>(null);
  const lo = draft?.lo ?? toIndex(min, 0);
  const hi = draft?.hi ?? toIndex(max, LAST);
  const setLo = (v: number) => setDraft({ lo: v, hi });
  const setHi = (v: number) => setDraft({ lo, hi: v });

  const label = (i: number) => (i >= LAST ? "sin límite" : `${STOPS[i]} €`);
  const commit = () => {
    if (!draft) return;
    onCommit(lo === 0 ? null : STOPS[lo], hi >= LAST ? null : STOPS[hi]);
    setDraft(null);
  };
  const pct = (i: number) => (i / LAST) * 100;

  return (
    <div>
      <p className="price mb-1 text-sm font-semibold text-ink" aria-live="polite">
        {lo === 0 && hi >= LAST
          ? "Cualquier precio"
          : hi >= LAST
            ? `Desde ${label(lo)}`
            : `${label(lo)} – ${label(hi)}`}
      </p>
      <div className="price-range relative h-11">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-muted" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-vivid"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        <input
          type="range"
          min={0}
          max={LAST}
          step={1}
          value={lo}
          aria-label="Precio mínimo"
          aria-valuetext={lo === 0 ? "sin mínimo" : label(lo)}
          onChange={(e) => setLo(Math.min(Number(e.target.value), hi - 1))}
          onPointerUp={commit}
          onKeyUp={commit}
        />
        <input
          type="range"
          min={0}
          max={LAST}
          step={1}
          value={hi}
          aria-label="Precio máximo"
          aria-valuetext={label(hi)}
          onChange={(e) => setHi(Math.max(Number(e.target.value), lo + 1))}
          onPointerUp={commit}
          onKeyUp={commit}
        />
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>0 €</span>
        <span>1000 € o más</span>
      </div>
    </div>
  );
}
