import { ImageResponse } from "next/og";
import { formatEuro } from "@/lib/money";
import {
  buildPulseBackgroundSvg,
  getPulseTheme,
  PULSE_SVG_PALETTES,
  type PulseThemeId,
} from "@/lib/pulse-themes";
import {
  adaptivePriceMetrics,
  PULSE_DISCOUNT_BADGE,
  PULSE_PRICE_BADGE,
  PULSE_STRIKE_BADGE,
  pulseScale,
} from "@/lib/social-pulse-metrics";

export interface SocialPulseRenderInput {
  title?: string | null;
  imageUrl?: string | null;
  currentPrice: number;
  previousPrice: number | null;
  discountPercentage: number;
  /** Lienzo cuadrado por defecto (feed/IG). */
  size?: number;
  pulseThemeId?: PulseThemeId;
}

function resolveDiscount(input: SocialPulseRenderInput): number {
  if (input.discountPercentage > 0) {
    return Math.max(0, Math.round(input.discountPercentage));
  }
  if (
    input.previousPrice != null &&
    input.previousPrice > input.currentPrice
  ) {
    return Math.max(
      0,
      Math.round(
        ((input.previousPrice - input.currentPrice) / input.previousPrice) *
          100,
      ),
    );
  }
  return 0;
}

function pulseBackgroundDataUrl(themeId: PulseThemeId): string {
  const svg = buildPulseBackgroundSvg(PULSE_SVG_PALETTES[themeId]);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Renderiza la plantilla Alerta YIR a PNG con next/og (Satori).
 * Compatible con Node (cron local) y runtime serverless.
 * Facebook: sin padding de imagen (cover a sangre).
 */
export async function renderSocialPulsePng(
  input: SocialPulseRenderInput,
): Promise<Buffer> {
  const size = input.size ?? 1080;
  const k = pulseScale(size);
  const theme = getPulseTheme(input.pulseThemeId);
  const discount = resolveDiscount(input);
  const previous =
    input.previousPrice != null && input.previousPrice > input.currentPrice
      ? input.previousPrice
      : null;
  const priceText = formatEuro(input.currentPrice);
  const previousText = previous != null ? formatEuro(previous) : null;
  const metrics = adaptivePriceMetrics(priceText, size);

  const frameInset = Math.round(size * 0.11);
  const frameRadius = Math.round(size * 0.045);
  const imageUrl = input.imageUrl?.trim() || null;
  const canUseImage = Boolean(imageUrl && /^https?:\/\//i.test(imageUrl));
  const bgDataUrl = pulseBackgroundDataUrl(theme.id);

  const response = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          backgroundColor: theme.fallback,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* Fondo YIR temático */}
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse/Satori */}
        <img
          src={bgDataUrl}
          alt=""
          width={size}
          height={size}
          style={{
            position: "absolute",
            inset: 0,
            width: size,
            height: size,
            objectFit: "cover",
            display: "flex",
          }}
        />

        {/* Marco producto — Facebook: sin padding, cover a sangre */}
        <div
          style={{
            position: "absolute",
            top: frameInset,
            left: frameInset,
            right: frameInset,
            bottom: Math.round(frameInset * 1.05),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: frameRadius,
            background: "#ffffff",
            boxShadow: "0 18px 48px rgba(0,0,0,0.18)",
            transform: "rotate(-2.5deg)",
            overflow: "hidden",
            padding: 0,
          }}
        >
          {canUseImage && imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse/Satori
            <img
              src={imageUrl}
              alt=""
              width={size}
              height={size}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "flex",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                color: "#a8a29e",
                fontSize: Math.round(size * 0.04),
              }}
            >
              Sin imagen
            </div>
          )}
        </div>

        {/* Badge descuento % (completamente redondo) */}
        {discount > 0 ? (
          <div
            style={{
              position: "absolute",
              top: Math.round(size * 0.07),
              left: Math.round(size * 0.06),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: PULSE_DISCOUNT_BADGE.width * k,
              padding: `${PULSE_DISCOUNT_BADGE.padY * k}px ${PULSE_DISCOUNT_BADGE.padX * k}px`,
              borderRadius: PULSE_DISCOUNT_BADGE.radius,
              background: theme.discountBg,
              boxShadow: PULSE_DISCOUNT_BADGE.shadow,
              color: "#ffffff",
              fontWeight: 800,
              fontSize: PULSE_DISCOUNT_BADGE.font * k,
              lineHeight: 1,
            }}
          >
            −{discount}%
          </div>
        ) : null}

        {/* Badges precio docked derecha */}
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: Math.round(size * 0.085),
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 10 * k,
            maxWidth: Math.round(size * 0.78),
          }}
        >
          {previousText ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                height: PULSE_STRIKE_BADGE.height * k,
                padding: `${PULSE_STRIKE_BADGE.padTop * k}px ${PULSE_STRIKE_BADGE.padRight * k}px ${PULSE_STRIKE_BADGE.padBottom * k}px ${PULSE_STRIKE_BADGE.padLeft * k}px`,
                borderRadius: "4999.5px 0 0 4999.5px",
                background: theme.priceGradient,
                boxShadow: PULSE_STRIKE_BADGE.shadow,
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  position: "relative",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: metrics.strike,
                  lineHeight: 1,
                }}
              >
                {previousText}
                <div
                  style={{
                    position: "absolute",
                    left: "-4%",
                    right: "-4%",
                    top: "50%",
                    height: Math.max(2.5, 3.5 * k),
                    background: theme.strikeLine,
                    transform: "translateY(-50%) rotate(-18deg)",
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              height: PULSE_PRICE_BADGE.height * k,
              padding: `${PULSE_PRICE_BADGE.padTop * k}px ${PULSE_PRICE_BADGE.padRight * k}px ${PULSE_PRICE_BADGE.padBottom * k}px ${PULSE_PRICE_BADGE.padLeft * k}px`,
              borderRadius: "9999px 0 0 9999px",
              background: theme.priceGradient,
              boxShadow: PULSE_PRICE_BADGE.shadow,
            }}
          >
            <div
              style={{
                display: "flex",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: metrics.main,
                lineHeight: 1,
              }}
            >
              {priceText}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
    },
  );

  return Buffer.from(await response.arrayBuffer());
}
