/**
 * Utilidades de histórico de precios: medias móviles y downsampling.
 */

export interface PricePoint {
  price: number;
  timestamp: string;
}

export function averageInWindow(
  points: PricePoint[],
  days: number,
  nowMs: number = Date.now(),
): number | null {
  if (points.length === 0) return null;
  const since = nowMs - days * 86_400_000;
  const inWindow = points.filter(
    (p) => new Date(p.timestamp).getTime() >= since,
  );
  if (inWindow.length === 0) return null;
  const sum = inWindow.reduce((acc, p) => acc + p.price, 0);
  return Math.round((sum / inWindow.length) * 100) / 100;
}

/** Reduce puntos uniformemente conservando extremos (para gráficos densos). */
export function downsamplePoints(
  points: PricePoint[],
  maxPoints: number,
): PricePoint[] {
  if (points.length <= maxPoints || maxPoints < 3) return points;
  const result: PricePoint[] = [];
  const lastIndex = points.length - 1;
  for (let i = 0; i < maxPoints; i++) {
    const index = Math.round((i / (maxPoints - 1)) * lastIndex);
    result.push(points[index]!);
  }
  // Deduplicate consecutive identical timestamps from rounding
  const deduped: PricePoint[] = [];
  for (const point of result) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.timestamp !== point.timestamp) {
      deduped.push(point);
    }
  }
  return deduped;
}

export function computeMovingAverages(points: PricePoint[]): {
  averagePrice30d: number | null;
  averagePrice90d: number | null;
} {
  return {
    averagePrice30d: averageInWindow(points, 30),
    averagePrice90d: averageInWindow(points, 90),
  };
}
