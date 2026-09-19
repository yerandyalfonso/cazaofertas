"use client";

import { useMemo, useState } from "react";
import { formatEuro } from "@/lib/money";
import { adaptivePriceMetrics } from "@/lib/social-pulse-metrics";

export interface PulseTemplateProduct {
  id: string;
  title: string;
  brand?: string | null;
  imageUrl?: string | null;
  currentPrice: number;
  previousPrice: number | null;
  discountPercentage: number;
}

export { adaptivePriceMetrics } from "@/lib/social-pulse-metrics";

function proxiedImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return `/api/admin/image-proxy?url=${encodeURIComponent(url.trim())}`;
}

function resolveDiscount(product: PulseTemplateProduct): number {
  if (product.discountPercentage > 0) {
    return Math.max(0, Math.round(product.discountPercentage));
  }
  if (
    product.previousPrice != null &&
    product.previousPrice > product.currentPrice
  ) {
    return Math.max(
      0,
      Math.round(
        ((product.previousPrice - product.currentPrice) /
          product.previousPrice) *
          100,
      ),
    );
  }
  return 0;
}

/**
 * Plantilla YIR / alerta naranja (Figma).
 * Fondo naranja + marco de producto + badge −% + bloque de precio adaptativo.
 */
export function SocialPulseTemplate({
  product,
  width,
  height,
}: {
  product: PulseTemplateProduct;
  width: number;
  height: number;
}) {
  const imageUrl = proxiedImageUrl(product.imageUrl);
  const [ready, setReady] = useState(false);
  const discount = resolveDiscount(product);
  const previous =
    product.previousPrice != null &&
    product.previousPrice > product.currentPrice
      ? product.previousPrice
      : null;

  const priceText = formatEuro(product.currentPrice);
  const previousText = previous != null ? formatEuro(previous) : null;
  const metrics = useMemo(
    () => adaptivePriceMetrics(priceText, width),
    [priceText, width],
  );

  const isPortrait = height > width * 1.15;
  const frameInset = isPortrait ? width * 0.08 : width * 0.07;
  const frameRadius = Math.round(width * 0.055);
  const frameRotate = -2.5;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        width,
        height,
        background:
          "linear-gradient(145deg, #ff8a1f 0%, #ff6b00 38%, #ff9500 72%, #ffb020 100%)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Geometría de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            "linear-gradient(125deg, transparent 42%, rgba(255,255,255,0.12) 42.5%, rgba(255,255,255,0.12) 48%, transparent 48.5%)",
            "linear-gradient(155deg, transparent 58%, rgba(0,0,0,0.06) 58.5%, rgba(0,0,0,0.06) 70%, transparent 70.5%)",
            `radial-gradient(circle at 88% 10%, rgba(180,60,0,0.18) 0 2px, transparent 2.5px)`,
            `radial-gradient(circle at 12% 88%, rgba(120,40,0,0.16) 0 2px, transparent 2.5px)`,
          ].join(", "),
          backgroundSize: "100% 100%, 100% 100%, 18px 18px, 22px 22px",
          backgroundPosition: "0 0, 0 0, 78% 6%, 4% 78%",
          backgroundRepeat: "no-repeat, no-repeat, repeat, repeat",
        }}
      />
      {/* Rejillas de puntos */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: height * 0.04,
          right: width * 0.05,
          width: width * 0.22,
          height: width * 0.22,
          backgroundImage:
            "radial-gradient(circle, rgba(120,40,0,0.35) 1.6px, transparent 1.8px)",
          backgroundSize: "14px 14px",
          opacity: 0.55,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          bottom: height * 0.06,
          left: width * 0.04,
          width: width * 0.28,
          height: width * 0.28,
          backgroundImage:
            "radial-gradient(circle, rgba(90,30,0,0.32) 1.6px, transparent 1.8px)",
          backgroundSize: "16px 16px",
          opacity: 0.5,
        }}
      />

      {/* Marco producto */}
      <div
        className="absolute overflow-hidden"
        style={{
          top: isPortrait ? height * 0.14 : frameInset,
          left: frameInset,
          right: frameInset,
          bottom: isPortrait ? height * 0.18 : frameInset * 1.15,
          borderRadius: frameRadius,
          background: "#f3f4f6",
          boxShadow:
            "0 0 0 10px #2a2a2a, 0 0 0 16px rgba(255,255,255,0.95), 0 28px 60px rgba(0,0,0,0.28)",
          transform: `rotate(${frameRotate}deg)`,
          transformOrigin: "center center",
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            onLoad={() => setReady(true)}
            onError={() => setReady(true)}
            className="h-full w-full object-contain"
            style={{
              opacity: ready ? 1 : 0.85,
              padding: Math.round(width * 0.03),
              background: "#f3f4f6",
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-stone-400">
            Sin imagen
          </div>
        )}
      </div>

      {/* Badge descuento */}
      {discount > 0 ? (
        <div
          className="absolute z-20 whitespace-nowrap font-extrabold tracking-tight text-white"
          style={{
            top: height * 0.055,
            left: width * 0.055,
            background: "#e85d04",
            padding: `${Math.round(width * 0.018)}px ${Math.round(width * 0.032)}px`,
            borderRadius: 999,
            fontSize: Math.round(width * 0.055),
            lineHeight: 1,
            boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
          }}
        >
          −{discount}%
        </div>
      ) : null}

      {/* Bloque precio adaptativo (abajo derecha) */}
      <div
        className="absolute z-20 flex flex-col items-end"
        style={{
          right: 0,
          bottom: height * 0.04,
          maxWidth: width * 0.72,
        }}
      >
        <div
          className="relative"
          style={{
            background:
              "linear-gradient(105deg, #ff9f1a 0%, #ff7a00 55%, #ff6200 100%)",
            clipPath: "polygon(12% 0, 100% 0, 100% 100%, 0 100%)",
            paddingTop: metrics.padY,
            paddingBottom: metrics.padY,
            paddingLeft: metrics.padX + Math.round(width * 0.04),
            paddingRight: metrics.padX,
            boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
            minWidth: Math.min(width * 0.42, Math.max(width * 0.28, metrics.main * 3.2)),
          }}
        >
          {previousText ? (
            <p
              className="absolute font-bold line-through"
              style={{
                top: metrics.padY * 0.35,
                right: metrics.padX + metrics.main * 0.15,
                fontSize: metrics.strike,
                color: "rgba(180, 70, 0, 0.55)",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
              aria-hidden
            >
              {previousText}
            </p>
          ) : null}
          <p
            className="relative font-extrabold tracking-tight text-white"
            style={{
              fontSize: metrics.main,
              lineHeight: 0.95,
              whiteSpace: "nowrap",
              textShadow: "0 2px 0 rgba(0,0,0,0.12)",
              marginTop: previousText ? metrics.strike * 0.35 : 0,
            }}
          >
            {priceText}
          </p>
        </div>
      </div>
    </div>
  );
}
