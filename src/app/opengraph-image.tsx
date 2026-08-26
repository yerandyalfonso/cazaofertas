import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CazaOferta — Revista de chollos Amazon España";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background:
            "linear-gradient(145deg, #0f766e 0%, #134e4a 42%, #1c1917 100%)",
          color: "#fafaf9",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          Revista de ofertas
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 92, lineHeight: 1, letterSpacing: "-0.03em" }}>
            CazaOferta
          </div>
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.3,
              maxWidth: 820,
              opacity: 0.92,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Chollos reales de Amazon España con historial de precios y alertas.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
