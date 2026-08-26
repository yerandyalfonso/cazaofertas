"use client";

import { useId, useMemo, useState } from "react";
import { formatEuro } from "@/lib/money";

interface PriceHistoryPoint {
  price: number;
  timestamp: string;
}

interface PriceHistoryChartProps {
  points: PriceHistoryPoint[];
  currentPrice?: number;
  averagePrice30d?: number | null;
  averagePrice90d?: number | null;
  /** Mínimo histórico all-time (products.lowest_price). */
  allTimeLowest?: number | null;
  className?: string;
}

type TimeRange = "1w" | "1m" | "3m";

interface DayPoint {
  price: number;
  timestamp: string;
  observed: boolean;
  label: string;
}

interface ChartCoord extends DayPoint {
  x: number;
  y: number;
}

const RANGE_OPTIONS: Array<{ id: TimeRange; label: string }> = [
  { id: "1w", label: "1 semana" },
  { id: "1m", label: "1 mes" },
  { id: "3m", label: "3 meses" },
];

const RANGE_DAYS: Record<TimeRange, number> = {
  "1w": 7,
  "1m": 30,
  "3m": 90,
};

const CHART_W = 720;
const CHART_H = 300;
const PAD = { top: 28, right: 28, bottom: 58, left: 28 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

const STROKE = "#0f766e";
const STROKE_DEEP = "#134e4a";

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toLocalDay(iso: string): Date {
  return startOfLocalDay(new Date(iso));
}

function formatDayLabel(date: Date, prev: Date | null, compact: boolean): string {
  if (!compact || !prev) {
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }
  if (
    date.getMonth() !== prev.getMonth() ||
    date.getFullYear() !== prev.getFullYear()
  ) {
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }
  return String(date.getDate());
}

function formatTooltipDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildDailySeries(
  points: PriceHistoryPoint[],
  range: TimeRange,
): DayPoint[] {
  if (points.length === 0) return [];

  const sorted = [...points].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const dayCount = RANGE_DAYS[range];
  const endDay = toLocalDay(sorted[sorted.length - 1]!.timestamp);
  const startDay = addLocalDays(endDay, -(dayCount - 1));

  const priceByDay = new Map<string, number>();
  for (const point of sorted) {
    priceByDay.set(dayKey(toLocalDay(point.timestamp)), point.price);
  }

  let carry: number | null = null;
  for (const point of sorted) {
    if (toLocalDay(point.timestamp).getTime() <= startDay.getTime()) {
      carry = point.price;
    }
  }

  const rows: Array<{
    day: Date;
    price: number | null;
    observed: boolean;
  }> = [];

  for (let i = 0; i < dayCount; i++) {
    const day = addLocalDays(startDay, i);
    const key = dayKey(day);
    const observed = priceByDay.has(key);
    if (observed) carry = priceByDay.get(key)!;
    rows.push({ day, price: carry, observed });
  }

  const firstPrice = rows.find((r) => r.price !== null)?.price ?? null;
  if (firstPrice === null) return [];
  for (const row of rows) {
    if (row.price === null) row.price = firstPrice;
    else break;
  }

  const compact = dayCount > 10;
  return rows.map((row, index) => {
    const prev = index > 0 ? rows[index - 1]!.day : null;
    const stamp = new Date(
      row.day.getFullYear(),
      row.day.getMonth(),
      row.day.getDate(),
      12,
      0,
      0,
      0,
    );
    return {
      price: row.price as number,
      timestamp: stamp.toISOString(),
      observed: row.observed,
      label: formatDayLabel(row.day, prev, compact),
    };
  });
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.05, 1);
    return [min - pad, min, min + pad].map((v) => Math.round(v * 100) / 100);
  }

  const span = max - min;
  const rawStep = span / Math.max(count - 1, 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const step =
    residual >= 5
      ? 5 * magnitude
      : residual >= 2
        ? 2 * magnitude
        : magnitude;

  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step * 0.001; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return ticks.length > 0 ? ticks : [min, max];
}

function toCoords(
  days: DayPoint[],
  yMin: number,
  yRange: number,
): ChartCoord[] {
  const n = days.length;
  if (n === 0) return [];

  return days.map((day, index) => {
    const x = PAD.left + ((index + 0.5) / n) * PLOT_W;
    const y = PAD.top + (1 - (day.price - yMin) / yRange) * PLOT_H;
    return { ...day, x, y };
  });
}

function buildStepPaths(coords: ChartCoord[]): { line: string; area: string } {
  if (coords.length === 0) return { line: "", area: "" };

  const left = PAD.left;
  const right = PAD.left + PLOT_W;
  const baseY = PAD.top + PLOT_H;
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;

  const parts: string[] = [`M ${left.toFixed(2)} ${first.y.toFixed(2)}`];
  parts.push(`L ${first.x.toFixed(2)} ${first.y.toFixed(2)}`);

  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1]!;
    const curr = coords[i]!;
    parts.push(`L ${curr.x.toFixed(2)} ${prev.y.toFixed(2)}`);
    parts.push(`L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`);
  }

  parts.push(`L ${right.toFixed(2)} ${last.y.toFixed(2)}`);
  const line = parts.join(" ");
  const area = `${line} L ${right.toFixed(2)} ${baseY.toFixed(2)} L ${left.toFixed(2)} ${baseY.toFixed(2)} Z`;
  return { line, area };
}

export function PriceHistoryChart({
  points,
  currentPrice,
  averagePrice30d = null,
  averagePrice90d = null,
  allTimeLowest = null,
  className = "",
}: PriceHistoryChartProps) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `ph-fill-${uid}`;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [range, setRange] = useState<TimeRange>("1m");

  const days = useMemo(() => buildDailySeries(points, range), [points, range]);

  const windowAverage = useMemo(() => {
    if (range === "3m") return averagePrice90d;
    if (range === "1m") return averagePrice30d;
    if (days.length === 0) return null;
    const sum = days.reduce((acc, d) => acc + d.price, 0);
    return Math.round((sum / days.length) * 100) / 100;
  }, [range, averagePrice30d, averagePrice90d, days]);

  const stats = useMemo(() => {
    if (days.length === 0) {
      return { min: 0, max: 0, current: currentPrice ?? 0 };
    }
    const prices = days.map((d) => d.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      current: currentPrice ?? prices[prices.length - 1]!,
    };
  }, [days, currentPrice]);

  const savings =
    stats.max > stats.current
      ? Math.round(((stats.max - stats.current) / stats.max) * 100)
      : null;

  const yTicks = useMemo(() => {
    if (days.length < 2) return [stats.min || 0];
    const lo = Math.min(
      stats.min,
      windowAverage ?? stats.min,
    );
    const hi = Math.max(
      stats.max,
      windowAverage ?? stats.max,
    );
    return niceTicks(lo, hi, 4);
  }, [days.length, stats.min, stats.max, windowAverage]);

  if (points.length < 2) {
    return (
      <div className={className}>
        <MetricBar
          min={stats.min || null}
          max={stats.max || null}
          current={currentPrice ?? null}
          average={windowAverage}
          averageLabel={range === "3m" ? "Media 90d" : "Media 30d"}
          allTimeLowest={allTimeLowest}
          savings={null}
          empty
        />
        <div className="mt-4 flex h-56 items-center justify-center border border-dashed border-stone-300/80 bg-gradient-to-b from-white to-stone-50 text-sm text-stone-500">
          Aún no hay histórico suficiente para graficar.
        </div>
      </div>
    );
  }

  const yMin = yTicks[0]!;
  const yMax = yTicks[yTicks.length - 1]!;
  const yRange = yMax - yMin || 1;
  const coords = toCoords(days, yMin, yRange);
  const { line: linePath, area: areaPath } = buildStepPaths(coords);
  const dense = coords.length > 14;
  const active = activeIndex !== null ? coords[activeIndex] : null;
  const avgY =
    windowAverage !== null
      ? PAD.top + (1 - (windowAverage - yMin) / yRange) * PLOT_H
      : null;

  return (
    <div className={className}>
      <MetricBar
        min={stats.min}
        max={stats.max}
        current={stats.current}
        average={windowAverage}
        averageLabel={
          range === "3m" ? "Media 90 días" : range === "1m" ? "Media 30 días" : "Media periodo"
        }
        allTimeLowest={allTimeLowest}
        savings={savings}
      />

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            Evolución
          </p>
          <p className="mt-1 font-display text-xl tracking-tight text-ink md:text-2xl">
            Histórico de precio
          </p>
        </div>
        <div
          className="inline-flex rounded-sm border border-stone-300/90 bg-stone-100/80 p-1"
          role="group"
          aria-label="Filtro temporal del histórico"
        >
          {RANGE_OPTIONS.map((option) => {
            const activeRange = range === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setRange(option.id);
                  setActiveIndex(null);
                }}
                className={`h-9 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                  activeRange
                    ? "bg-ink text-paper shadow-sm"
                    : "bg-transparent text-stone-500 hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="relative mt-4 overflow-visible border border-stone-200/90 bg-gradient-to-b from-white via-white to-teal-50/40"
        onMouseLeave={() => setActiveIndex(null)}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-700/40 to-transparent"
          aria-hidden
        />

        <div className="flex items-stretch gap-1 px-4 pb-4 pt-4">
          <div className="relative w-[4.25rem] shrink-0" aria-hidden>
            <div
              className="absolute inset-x-0"
              style={{
                top: `${(PAD.top / CHART_H) * 100}%`,
                bottom: `${(PAD.bottom / CHART_H) * 100}%`,
              }}
            >
              {yTicks.map((tick) => {
                const topPct = ((yMax - tick) / yRange) * 100;
                return (
                  <span
                    key={`yl-${tick}`}
                    className="absolute right-2 -translate-y-1/2 text-right text-[10px] tabular-nums tracking-wide text-stone-400"
                    style={{ top: `${topPct}%` }}
                  >
                    {formatEuro(tick)}
                  </span>
                );
              })}
            </div>
          </div>

          <div
            className="relative min-w-0 flex-1 overflow-visible"
            style={{ aspectRatio: `${CHART_W} / ${CHART_H}` }}
          >
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 block overflow-visible"
              role="img"
              aria-label="Histórico de precios"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={STROKE} stopOpacity="0.28" />
                  <stop offset="45%" stopColor={STROKE} stopOpacity="0.1" />
                  <stop offset="100%" stopColor={STROKE} stopOpacity="0" />
                </linearGradient>
              </defs>

              {yTicks.map((tick) => {
                const y = PAD.top + (1 - (tick - yMin) / yRange) * PLOT_H;
                const isBase = tick === yMin;
                return (
                  <line
                    key={`yg-${tick}`}
                    x1={PAD.left}
                    y1={y}
                    x2={CHART_W - PAD.right}
                    y2={y}
                    stroke={isBase ? "#d6d3d1" : "#e7e5e4"}
                    strokeWidth={isBase ? 1.25 : 1}
                    strokeDasharray={isBase ? undefined : "2 6"}
                  />
                );
              })}

              <path d={areaPath} fill={`url(#${gradientId})`} />
              {avgY !== null ? (
                <line
                  x1={PAD.left}
                  y1={avgY}
                  x2={CHART_W - PAD.right}
                  y2={avgY}
                  stroke="#a8a29e"
                  strokeWidth="1.5"
                  strokeDasharray="6 5"
                />
              ) : null}
              <path
                d={linePath}
                fill="none"
                stroke={STROKE}
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {coords.map((point, index) => {
                const isActive = activeIndex === index;
                const labelY = PAD.top + PLOT_H + (dense ? 16 : 20);
                return (
                  <g key={`${dayKey(toLocalDay(point.timestamp))}-${index}`}>
                    {isActive ? (
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="11"
                        fill={STROKE}
                        fillOpacity="0.12"
                      />
                    ) : null}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={isActive ? 5.5 : 3}
                      fill={isActive ? STROKE_DEEP : STROKE}
                      stroke="#fff"
                      strokeWidth={isActive ? 2 : 1.5}
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="15"
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setActiveIndex(index)}
                      onFocus={() => setActiveIndex(index)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${formatEuro(point.price)} el ${formatTooltipDate(point.timestamp)}`}
                    />
                    <text
                      x={point.x}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      transform={
                        dense
                          ? `rotate(-48 ${point.x} ${labelY})`
                          : undefined
                      }
                      fill={isActive ? "#292524" : "#a8a29e"}
                      fontWeight={isActive ? 600 : 400}
                      style={{
                        fontSize: dense ? 9 : 11,
                        fontFamily:
                          "var(--font-body), system-ui, sans-serif",
                      }}
                    >
                      {point.label}
                    </text>
                  </g>
                );
              })}

              {active ? (
                <line
                  x1={active.x}
                  y1={PAD.top}
                  x2={active.x}
                  y2={PAD.top + PLOT_H}
                  stroke={STROKE}
                  strokeOpacity="0.2"
                  strokeWidth="1"
                  strokeDasharray="3 5"
                />
              ) : null}
            </svg>

            {active && activeIndex !== null ? (
              <div
                className="pointer-events-none absolute z-20 min-w-[10rem] border border-stone-800/10 bg-ink/95 px-3.5 py-2.5 text-paper backdrop-blur-sm"
                style={{
                  left: `${(active.x / CHART_W) * 100}%`,
                  top: `${(active.y / CHART_H) * 100}%`,
                  transform: (() => {
                    const xPct = active.x / CHART_W;
                    const yPct = active.y / CHART_H;
                    const tx =
                      xPct < 0.15 ? "0%" : xPct > 0.85 ? "-100%" : "-50%";
                    const ty =
                      yPct < 0.35 ? "14px" : "calc(-100% - 14px)";
                    return `translate(${tx}, ${ty})`;
                  })(),
                }}
              >
                <p className="font-display text-xl tracking-tight">
                  {formatEuro(active.price)}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-paper/65">
                  {formatTooltipDate(active.timestamp)}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBar({
  min,
  max,
  current,
  average,
  averageLabel,
  allTimeLowest,
  savings,
  empty = false,
}: {
  min: number | null;
  max: number | null;
  current: number | null;
  average?: number | null;
  averageLabel?: string;
  allTimeLowest?: number | null;
  savings: number | null;
  empty?: boolean;
}) {
  const items = [
    {
      label: "Mín. periodo",
      value: min,
      hint: "Mejor precio del rango visible",
      accent: "border-t-teal-700",
      valueClass: "text-teal-900",
    },
    {
      label: "Mín. histórico",
      value: allTimeLowest ?? null,
      hint: "All-time (catálogo)",
      accent: "border-t-teal-900",
      valueClass: "text-teal-950",
    },
    {
      label: averageLabel ?? "Media",
      value: average ?? null,
      hint: "Media móvil del periodo",
      accent: "border-t-stone-400",
      valueClass: "text-stone-700",
    },
    {
      label: "Máximo",
      value: max,
      hint: "Pico del periodo",
      accent: "border-t-stone-400",
      valueClass: "text-stone-700",
    },
    {
      label: "Actual",
      value: current,
      hint:
        savings && savings > 0
          ? `${savings}% bajo el máximo`
          : "Precio vigente",
      accent: "border-t-ink",
      valueClass: "text-ink",
    },
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className={`border border-stone-200/90 border-t-2 bg-gradient-to-b from-white to-stone-50/60 px-4 py-3.5 ${item.accent}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            {item.label}
          </p>
          <p
            className={`mt-1.5 font-display text-2xl tracking-tight md:text-[1.65rem] ${item.valueClass}`}
          >
            {empty || item.value === null ? "—" : formatEuro(item.value)}
          </p>
          <p className="mt-1 text-[11px] text-stone-400">{item.hint}</p>
        </div>
      ))}
    </div>
  );
}
