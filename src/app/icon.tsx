import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Favicon: icono de «Una mica de tot» (versión de trazo grueso) sobre fondo claro. */
export default async function Icon() {
  const svg = await readFile(
    path.join(process.cwd(), "public/brand/una-mica-de-tot-mark-sm.svg"),
  );
  const src = `data:image/svg+xml;base64,${svg.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f2f4f6",
          borderRadius: 14,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori solo admite <img> */}
        <img src={src} width={54} height={54} alt="" />
      </div>
    ),
    { ...size },
  );
}
