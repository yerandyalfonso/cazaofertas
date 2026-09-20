"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEuro } from "@/lib/money";
import type { SocialCardImageFit } from "@/lib/social-card-projects";
import {
  adaptivePriceMetrics,
  PULSE_DISCOUNT_BADGE,
  PULSE_PRICE_BADGE,
  PULSE_STRIKE_BADGE,
  pulseScale,
} from "@/lib/social-pulse-metrics";
import { getPulseTheme, type PulseThemeId } from "@/lib/pulse-themes";

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

export interface PulseImageStyle {
  imageFit?: SocialCardImageFit;
  imagePadX?: number;
  imagePadY?: number;
  pulseThemeId?: PulseThemeId;
}

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
 * En el editor usa el mismo imageFit / padding que el resto de layouts.
 */
export function SocialPulseTemplate({
  product,
  width,
  height,
  imageFit = "contain",
  imagePadX = 40,
  imagePadY = 40,
  pulseThemeId = "amber",
}: {
  product: PulseTemplateProduct;
  width: number;
  height: number;
} & PulseImageStyle) {
  const theme = getPulseTheme(pulseThemeId);
  const imageUrl = proxiedImageUrl(product.imageUrl);
  const [ready, setReady] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    null,
  );

  useEffect(() => {
    setReady(false);
    setNatural(null);
  }, [imageUrl, imageFit, product.id]);

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
  const k = pulseScale(width);

  const isPortrait = height > width * 1.15;
  const frameInset = isPortrait ? width * 0.1 : width * 0.11;
  const frameRadius = Math.round(width * 0.045);
  const frameRotate = -2.5;

  const frameTop = isPortrait ? height * 0.16 : frameInset;
  const frameBottom = isPortrait ? height * 0.2 : frameInset * 1.05;
  const frameW = width - frameInset * 2;
  const frameH = height - frameTop - frameBottom;

  const resolvedFit = (() => {
    if (imageFit !== "smart") return imageFit;
    if (!natural) return "blur" as const;
    const imgRatio = natural.w / Math.max(natural.h, 1);
    const areaRatio = frameW / Math.max(frameH, 1);
    const diff = Math.abs(imgRatio - areaRatio) / areaRatio;
    return diff < 0.22 ? ("cover" as const) : ("blur" as const);
  })();

  // Alerta YIR: siempre contain — manda la dimensión que toque el borde primero
  // para ver el producto entero (sin recortar).
  const objectFit = "contain" as const;
  const objectPosition = "center";
  const useBlurBackdrop = resolvedFit === "blur";

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        width,
        height,
        backgroundColor: theme.fallback,
        backgroundImage: `url(${theme.bgPath})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Marco producto — mismos controles de imagen que el resto del editor */}
      <div
        className="absolute overflow-hidden bg-white"
        style={{
          top: frameTop,
          left: frameInset,
          right: frameInset,
          bottom: frameBottom,
          borderRadius: frameRadius,
          boxShadow: "0 18px 48px rgba(0,0,0,0.18)",
          transform: `rotate(${frameRotate}deg)`,
          transformOrigin: "center center",
        }}
      >
        {imageUrl ? (
          <div className="relative h-full w-full overflow-hidden">
            {useBlurBackdrop ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover"
                style={{
                  filter: "blur(28px) saturate(1.05)",
                  transform: "scale(1.15)",
                }}
              />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              crossOrigin="anonymous"
              onLoad={(event) => {
                const el = event.currentTarget;
                setNatural({ w: el.naturalWidth, h: el.naturalHeight });
                setReady(true);
              }}
              onError={() => setReady(true)}
              className="relative z-[1] h-full w-full"
              style={{
                objectFit,
                objectPosition,
                opacity: ready ? 1 : 0.85,
                padding:
                  imagePadX || imagePadY
                    ? `${imagePadY}px ${imagePadX}px`
                    : undefined,
              }}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-stone-400">
            Sin imagen
          </div>
        )}
      </div>

      {/* Badge descuento % (completamente redondo) */}
      {discount > 0 ? (
        <div
          className="absolute z-20 flex items-center justify-center whitespace-nowrap font-extrabold tracking-tight text-white"
          style={{
            top: height * 0.07,
            left: width * 0.06,
            width: PULSE_DISCOUNT_BADGE.width * k,
            padding: `${PULSE_DISCOUNT_BADGE.padY * k}px ${PULSE_DISCOUNT_BADGE.padX * k}px`,
            borderRadius: PULSE_DISCOUNT_BADGE.radius,
            background: theme.discountBg,
            boxShadow: PULSE_DISCOUNT_BADGE.shadow,
            fontSize: PULSE_DISCOUNT_BADGE.font * k,
            lineHeight: 1,
            gap: 5 * k,
          }}
        >
          −{discount}%
        </div>
      ) : null}

      {/* Badges precio: docked al borde derecho */}
      <div
        className="absolute z-20 flex flex-col items-end"
        style={{
          right: 0,
          bottom: height * 0.085,
          gap: 10 * k,
          maxWidth: width * 0.78,
        }}
      >
        {previousText ? (
          <div
            className="relative inline-flex items-center justify-end"
            style={{
              height: PULSE_STRIKE_BADGE.height * k,
              padding: `${PULSE_STRIKE_BADGE.padTop * k}px ${PULSE_STRIKE_BADGE.padRight * k}px ${PULSE_STRIKE_BADGE.padBottom * k}px ${PULSE_STRIKE_BADGE.padLeft * k}px`,
              borderRadius: PULSE_STRIKE_BADGE.radius,
              background: theme.priceGradient,
              boxShadow: PULSE_STRIKE_BADGE.shadow,
              gap: 5 * k,
            }}
          >
            <span
              className="relative font-extrabold tracking-tight text-white"
              style={{
                fontSize: metrics.strike,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {previousText}
              <span
                aria-hidden
                className="pointer-events-none absolute left-[-4%] right-[-4%] top-1/2 block origin-center -translate-y-1/2 -rotate-[18deg] rounded-full"
                style={{
                  background: theme.strikeLine,
                  height: Math.max(2.5, 3.5 * k),
                }}
              />
            </span>
          </div>
        ) : null}

        <div
          className="inline-flex items-center justify-end"
          style={{
            height: PULSE_PRICE_BADGE.height * k,
            padding: `${PULSE_PRICE_BADGE.padTop * k}px ${PULSE_PRICE_BADGE.padRight * k}px ${PULSE_PRICE_BADGE.padBottom * k}px ${PULSE_PRICE_BADGE.padLeft * k}px`,
            borderRadius: PULSE_PRICE_BADGE.radius,
            background: theme.priceGradient,
            boxShadow: PULSE_PRICE_BADGE.shadow,
            gap: 10 * k,
          }}
        >
          <span
            className="font-extrabold tracking-tight text-white"
            style={{
              fontSize: metrics.main,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {priceText}
          </span>
        </div>
      </div>
    </div>
  );
}
