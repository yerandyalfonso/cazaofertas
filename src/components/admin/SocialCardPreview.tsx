"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEuro } from "@/lib/money";
import type {
  SocialCardFormatId,
  SocialCardImageFit,
  SocialCardLayoutId,
} from "@/lib/social-card-projects";

export interface SocialCardPreviewProduct {
  id: string;
  title: string;
  brand: string | null;
  imageUrl?: string | null;
  currentPrice: number;
  previousPrice: number | null;
  discountPercentage: number;
}

export interface SocialCardPreviewStyle {
  formatId: SocialCardFormatId;
  layoutId: SocialCardLayoutId;
  colorTone: number;
  imageFit: SocialCardImageFit;
  imagePadX: number;
  imagePadY: number;
  cardRadius: number;
  cardSurfaceColor: string;
  floatRotate?: number;
  floatOffsetX?: number;
  floatOffsetY?: number;
  floatZoom?: number;
  textPadX?: number;
  textPadY?: number;
}

const FORMATS: Record<
  SocialCardFormatId,
  { width: number; height: number }
> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  classic: { width: 1080, height: 810 },
};

function hsl(h: number, s: number, l: number, a = 1): string {
  const hh = ((h % 360) + 360) % 360;
  if (a < 1) {
    return `hsla(${Math.round(hh)} ${Math.round(s)}% ${Math.round(l)}% / ${Number(a.toFixed(3))})`;
  }
  return `hsl(${Math.round(hh)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function themeFromTone(toneInput: number) {
  const tone = Math.min(100, Math.max(0, toneInput));
  const t = tone / 100;
  const band = t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2;
  const local = band === 0 ? t * 3 : band === 1 ? (t - 1 / 3) * 3 : (t - 2 / 3) * 3;
  const hue = (local * 360 + band * 47) % 360;
  const h2 = (hue + 42 + local * 28) % 360;
  const h3 = (hue + 86 + local * 36) % 360;
  const h4 = (hue + 148 + band * 22) % 360;

  let sat: number;
  let satSpread: number;
  let light0: number;
  let lightSpread: number;
  let overlayStrength: number;
  let accentSat: number;
  let brandL: number;

  if (band === 0) {
    sat = lerp(40, 58, local);
    satSpread = 20;
    light0 = lerp(94, 89, local);
    lightSpread = 12;
    overlayStrength = lerp(0.3, 0.44, local);
    accentSat = 80;
    brandL = 36;
  } else if (band === 1) {
    sat = lerp(72, 94, local);
    satSpread = 24;
    light0 = lerp(89, 82, local);
    lightSpread = 16;
    overlayStrength = lerp(0.46, 0.62, local);
    accentSat = 92;
    brandL = 40;
  } else {
    sat = lerp(48, 26, local);
    satSpread = 16;
    light0 = lerp(95, 97, local);
    lightSpread = 7;
    overlayStrength = lerp(0.24, 0.34, local);
    accentSat = 74;
    brandL = 42;
  }

  const c1 = hsl(hue, sat, light0);
  const c2 = hsl(h2, Math.min(98, sat + satSpread * 0.4), light0 - lightSpread * 0.4);
  const c3 = hsl(h3, Math.min(98, sat + satSpread * 0.85), light0 - lightSpread * 0.85);
  const c4 = hsl(h4, Math.max(16, sat - 4), light0 - lightSpread * 0.3);
  const angle = 128 + Math.round(local * 52 + band * 18);

  return {
    canvasBg: `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 26%, ${c3} 58%, ${c4} 100%)`,
    canvasOverlay: [
      `radial-gradient(ellipse 60% 48% at ${10 + local * 22}% ${12 + band * 8}%, ${hsl(0, 0, 100, 0.92)} 0%, transparent 58%)`,
      `radial-gradient(ellipse 50% 42% at ${88 - local * 14}% ${18 + local * 16}%, ${hsl(hue, Math.min(98, sat + 12), 64, overlayStrength)} 0%, transparent 55%)`,
    ].join(", "),
    brandColor: hsl((hue + 10) % 360, Math.min(72, sat + 8), brandL),
    titleColor: band === 1 ? "#1e1b4b" : band === 0 ? "#292524" : "#2a2438",
    priceAccent: hsl(
      band === 2 ? (22 + local * 18) % 360 : (hue + 14) % 360,
      accentSat,
      band === 1 ? 47 : 50,
    ),
    priceStrike: "#a8a29e",
    bannerBg: `linear-gradient(90deg, ${hsl(hue, 80, 55)} 0%, ${hsl(h3, 75, 48)} 100%)`,
    sealBg: `linear-gradient(145deg, ${hsl(hue, 85, 52)} 0%, ${hsl(h3, 80, 42)} 100%)`,
    cardBorder: "1px solid rgba(28,25,23,0.06)",
    cardShadow: "0 24px 48px rgba(15,23,42,0.14)",
  };
}

function proxiedImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return `/api/admin/image-proxy?url=${encodeURIComponent(url.trim())}`;
}

export function socialCardFormatSize(formatId: SocialCardFormatId) {
  return FORMATS[formatId] ?? FORMATS.story;
}

export function SocialCardPreview({
  product,
  style,
  cardRef,
  scale = 1,
}: {
  product: SocialCardPreviewProduct;
  style: SocialCardPreviewStyle;
  cardRef?: React.Ref<HTMLDivElement>;
  scale?: number;
}) {
  const format = socialCardFormatSize(style.formatId);
  const theme = useMemo(() => themeFromTone(style.colorTone), [style.colorTone]);
  const imageUrl = proxiedImageUrl(product.imageUrl);
  const [ready, setReady] = useState(false);
  const [bg, setBg] = useState<string | null>(null);
  const discount = Math.max(0, Math.round(product.discountPercentage || 0));
  const previous =
    product.previousPrice != null &&
    product.previousPrice > product.currentPrice
      ? product.previousPrice
      : null;
  const isStory = style.formatId === "story";
  const isLandscape = style.formatId === "landscape";
  const pad = isLandscape ? 48 : isStory ? 64 : 48;
  const titleSize = isStory ? 48 : isLandscape ? 40 : 44;
  const brandSize = isStory ? 24 : 20;
  const priceSize = isStory ? 68 : isLandscape ? 56 : 60;
  const strikeSize = isStory ? 32 : 28;
  const textPadX = style.textPadX ?? 44;
  const textPadY = style.textPadY ?? 40;
  const floatZoom = Math.max(0.4, Math.min(2, style.floatZoom ?? 1));
  const imageAreaBg =
    style.imageFit === "blur" ? (bg ?? "#f5f5f4") : style.cardSurfaceColor;

  useEffect(() => {
    setReady(false);
    setBg(null);
  }, [imageUrl, style.imageFit, product.id]);

  const objectFit =
    style.imageFit === "contain"
      ? "contain"
      : style.imageFit === "cover-top"
        ? "cover"
        : style.imageFit === "blur"
          ? "contain"
          : "cover";
  const objectPosition =
    style.imageFit === "cover-top" ? "center top" : "center";

  function Media({
    width,
    height,
    radius,
    zoom = 1,
  }: {
    width: number | string;
    height: number | string;
    radius: number;
    zoom?: number;
  }) {
    return (
      <div
        className="relative h-full min-h-0 w-full overflow-hidden"
        style={{
          width,
          height,
          borderRadius: radius,
          background: imageAreaBg,
        }}
      >
        {style.imageFit === "blur" && imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover"
            style={{ filter: "blur(28px)", transform: "scale(1.15)" }}
          />
        ) : null}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            onLoad={() => setReady(true)}
            onError={() => setReady(true)}
            className="relative z-[1] h-full w-full"
            style={{
              objectFit,
              objectPosition,
              opacity: ready ? 1 : 0.85,
              padding:
                style.imagePadX || style.imagePadY
                  ? `${style.imagePadY}px ${style.imagePadX}px`
                  : undefined,
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: "center center",
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm opacity-40">
            Sin imagen
          </div>
        )}
      </div>
    );
  }

  function Badge() {
    if (discount <= 0) return null;
    if (style.layoutId === "seal") {
      return (
        <div
          className="absolute z-[3] flex items-center justify-center font-extrabold text-white"
          style={{
            top: 28,
            right: 28,
            width: isStory ? 140 : 120,
            height: isStory ? 140 : 120,
            borderRadius: "50%",
            background: theme.sealBg,
            fontSize: isStory ? 36 : 30,
            boxShadow: "0 12px 28px rgba(0,0,0,0.2)",
          }}
        >
          −{discount}%
        </div>
      );
    }
    return (
      <div
        className="absolute z-[3] font-extrabold text-white"
        style={{
          top: 28,
          left: 28,
          background: theme.priceAccent,
          padding: "10px 18px",
          borderRadius: 999,
          fontSize: isStory ? 28 : 24,
        }}
      >
        −{discount}%
      </div>
    );
  }

  /** Zona de texto siempre anclada abajo; el padding es configurable. */
  function Copy({ clamp = 3 }: { clamp?: number }) {
    return (
      <div
        className="shrink-0"
        style={{
          padding: `${textPadY}px ${textPadX}px`,
        }}
      >
        {product.brand ? (
          <p
            className="font-bold uppercase tracking-[0.14em]"
            style={{ fontSize: brandSize, color: theme.brandColor }}
          >
            {product.brand}
          </p>
        ) : null}
        <h2
          className="font-semibold leading-snug"
          style={{
            marginTop: product.brand ? 10 : 0,
            fontSize: titleSize,
            color: theme.titleColor,
            display: "-webkit-box",
            WebkitLineClamp: clamp,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {product.title}
        </h2>
        <div style={{ marginTop: Math.max(16, Math.round(textPadY * 0.55)) }}>
          <div className="flex flex-wrap items-baseline gap-x-5">
            <span
              className="font-extrabold tracking-tight"
              style={{ fontSize: priceSize, color: theme.priceAccent }}
            >
              {formatEuro(product.currentPrice)}
            </span>
            {previous != null ? (
              <span
                className="font-medium line-through"
                style={{ fontSize: strikeSize, color: theme.priceStrike }}
              >
                {formatEuro(previous)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const cardShell = (opts: {
    children: React.ReactNode;
    overflow?: "hidden" | "visible";
  }) => (
    <div
      className="relative flex h-full w-full flex-col"
      style={{
        background: style.cardSurfaceColor,
        borderRadius: style.cardRadius,
        border: theme.cardBorder,
        boxShadow: theme.cardShadow,
        overflow: opts.overflow ?? "hidden",
      }}
    >
      {opts.children}
    </div>
  );

  const cardInner = (() => {
    if (style.layoutId === "banner") {
      return cardShell({
        children: (
          <>
            <div
              className="flex shrink-0 items-center justify-between"
              style={{
                background: theme.bannerBg,
                padding: isStory ? "18px 32px" : "14px 28px",
              }}
            >
              <p
                className="font-bold uppercase tracking-[0.16em] text-white"
                style={{ fontSize: isStory ? 26 : 20 }}
              >
                {product.brand ||
                  (discount > 0 ? `Chollo −${discount}%` : "CazaOfertas")}
              </p>
            </div>
            <div className="relative min-h-0 w-full flex-1">
              <Media width="100%" height="100%" radius={0} />
            </div>
            <Copy clamp={isLandscape ? 2 : 3} />
          </>
        ),
      });
    }

    if (style.layoutId === "float") {
      const rotate = style.floatRotate ?? -3;
      const offsetX = style.floatOffsetX ?? 0;
      const offsetY = style.floatOffsetY ?? 0;
      // Marco flotante más contenido en landscape para no rozar bordes.
      const frameW = isLandscape ? "52%" : "78%";
      const frameTop = isLandscape ? 28 + offsetY : 40 + offsetY;
      const frameLeft = isLandscape
        ? `calc(24% + ${offsetX}px)`
        : `calc(11% + ${offsetX}px)`;

      return cardShell({
        overflow: "visible",
        children: (
          <>
            {/* Reserva visual superior: la imagen flota encima; el texto queda abajo. */}
            <div className="relative min-h-0 w-full flex-1" aria-hidden />
            <Copy clamp={isLandscape ? 2 : 4} />
            <div
              className="pointer-events-none absolute z-[2]"
              style={{
                top: frameTop,
                left: frameLeft,
                width: frameW,
                height: isLandscape ? "58%" : "52%",
                borderRadius: Math.max(24, style.cardRadius - 4),
                transform: `rotate(${rotate}deg)`,
                transformOrigin: "center center",
                boxShadow: "0 24px 48px rgba(15,23,42,0.28)",
                background: imageAreaBg,
                overflow: "hidden",
              }}
            >
              <Media
                width="100%"
                height="100%"
                radius={Math.max(16, style.cardRadius - 12)}
                zoom={floatZoom}
              />
            </div>
            <Badge />
          </>
        ),
      });
    }

    // minimal + seal — imagen arriba (flex-1), texto abajo
    return cardShell({
      children: (
        <>
          <Badge />
          <div className="relative min-h-0 w-full flex-1">
            <Media width="100%" height="100%" radius={0} />
          </div>
          <Copy clamp={isLandscape ? 2 : 3} />
        </>
      ),
    });
  })();

  return (
    <div
      ref={cardRef}
      data-product-id={product.id}
      className="relative"
      style={{
        width: format.width,
        height: format.height,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top left",
        background: theme.canvasBg,
        overflow: style.layoutId === "float" ? "visible" : "hidden",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: theme.canvasOverlay }}
      />
      <div
        className="relative z-[1] h-full w-full"
        style={{
          padding: pad,
          // En flotante dejamos que el marco inclinado salga un poco del card
          // sin cortarse contra el lienzo (el overflow del canvas sigue limpio).
          overflow: style.layoutId === "float" ? "visible" : "hidden",
        }}
      >
        {cardInner}
      </div>
    </div>
  );
}
