import { ImageResponse } from "next/og";
import { formatEuro } from "@/lib/money";
import { adaptivePriceMetrics } from "@/lib/social-pulse-metrics";

export interface SocialPulseRenderInput {
  title?: string | null;
  imageUrl?: string | null;
  currentPrice: number;
  previousPrice: number | null;
  discountPercentage: number;
  /** Lienzo cuadrado por defecto (feed/IG). */
  size?: number;
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

/**
 * Renderiza la plantilla Alerta YIR (naranja) a PNG con next/og (Satori).
 * Compatible con Node (cron local) y runtime serverless.
 */
export async function renderSocialPulsePng(
  input: SocialPulseRenderInput,
): Promise<Buffer> {
  const size = input.size ?? 1080;
  const discount = resolveDiscount(input);
  const previous =
    input.previousPrice != null && input.previousPrice > input.currentPrice
      ? input.previousPrice
      : null;
  const priceText = formatEuro(input.currentPrice);
  const previousText = previous != null ? formatEuro(previous) : null;
  const metrics = adaptivePriceMetrics(priceText, size);

  const frameInset = Math.round(size * 0.07);
  const frameRadius = Math.round(size * 0.055);
  const imageUrl = input.imageUrl?.trim() || null;
  const canUseImage = Boolean(imageUrl && /^https?:\/\//i.test(imageUrl));

  const response = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(145deg, #ff8a1f 0%, #ff6b00 38%, #ff9500 72%, #ffb020 100%)",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* Diagonal highlight */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(125deg, transparent 42%, rgba(255,255,255,0.12) 42.5%, rgba(255,255,255,0.12) 48%, transparent 48.5%)",
          }}
        />

        {/* Product frame */}
        <div
          style={{
            position: "absolute",
            top: frameInset,
            left: frameInset,
            right: frameInset,
            bottom: Math.round(frameInset * 1.15),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: frameRadius,
            background: "#f3f4f6",
            border: "10px solid #2a2a2a",
            boxShadow: "0 0 0 6px rgba(255,255,255,0.95), 0 28px 60px rgba(0,0,0,0.28)",
            transform: "rotate(-2.5deg)",
            overflow: "hidden",
            padding: Math.round(size * 0.03),
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
                objectFit: "contain",
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

        {/* Discount badge */}
        {discount > 0 ? (
          <div
            style={{
              position: "absolute",
              top: Math.round(size * 0.055),
              left: Math.round(size * 0.055),
              display: "flex",
              alignItems: "center",
              background: "#e85d04",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: Math.round(size * 0.055),
              lineHeight: 1,
              padding: `${Math.round(size * 0.018)}px ${Math.round(size * 0.032)}px`,
              borderRadius: 999,
              boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
            }}
          >
            −{discount}%
          </div>
        ) : null}

        {/* Adaptive price block (bottom-right wedge via skew) */}
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: Math.round(size * 0.04),
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            maxWidth: Math.round(size * 0.72),
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              background:
                "linear-gradient(105deg, #ff9f1a 0%, #ff7a00 55%, #ff6200 100%)",
              transform: "skewX(-12deg)",
              paddingTop: metrics.padY,
              paddingBottom: metrics.padY,
              paddingLeft: metrics.padX + Math.round(size * 0.04),
              paddingRight: metrics.padX,
              boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
              minWidth: Math.min(
                size * 0.42,
                Math.max(size * 0.28, metrics.main * 3.2),
              ),
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                transform: "skewX(12deg)",
              }}
            >
              {previousText ? (
                <div
                  style={{
                    display: "flex",
                    fontWeight: 700,
                    textDecoration: "line-through",
                    fontSize: metrics.strike,
                    color: "rgba(180, 70, 0, 0.55)",
                    lineHeight: 1,
                    marginBottom: Math.round(metrics.strike * 0.15),
                  }}
                >
                  {previousText}
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  fontWeight: 800,
                  color: "#ffffff",
                  fontSize: metrics.main,
                  lineHeight: 0.95,
                  letterSpacing: "-0.02em",
                  textShadow: "0 2px 0 rgba(0,0,0,0.12)",
                }}
              >
                {priceText}
              </div>
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
