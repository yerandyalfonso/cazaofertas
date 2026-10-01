import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";

export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "m.media-amazon.com",
  "images-na.ssl-images-amazon.com",
  "images-eu.ssl-images-amazon.com",
  "images-amazon.com",
  "media-amazon.com",
]);

/** CDNs de imagen de las demás tiendas (ver `products.image_url`). */
const RETAILER_IMAGE_HOSTS = new Set([
  "static.kiabi.es",
  "assets.mmsrg.com",
]);

function isAllowedImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return (
      ALLOWED_HOSTS.has(host) ||
      host.endsWith(".media-amazon.com") ||
      host.endsWith(".ssl-images-amazon.com") ||
      host.endsWith(".images-amazon.com") ||
      host === "images.unsplash.com" ||
      host.endsWith(".supabase.co") ||
      RETAILER_IMAGE_HOSTS.has(host) ||
      host.endsWith(".miravia.es") ||
      host.endsWith(".mrvcdn.com") ||
      // Fotos de Carrefour: su bucket público y las que subimos a nuestro Storage.
      (host === "storage.googleapis.com" &&
        url.pathname.startsWith("/catalog-pictures-carrefour-es/")) ||
      ((host === "unamicadetot.com" || host === "blog.chollosdhoy.com") &&
        url.pathname.startsWith("/storage/v1/object/public/"))
    );
  } catch {
    return false;
  }
}

/**
 * Proxy same-origin de imágenes de producto para poder exportar PNG
 * (canvas / html-to-image necesita CORS o origen propio).
 */
export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const raw = request.nextUrl.searchParams.get("url")?.trim() ?? "";
    if (!raw || !isAllowedImageUrl(raw)) {
      return NextResponse.json(
        { ok: false, error: "URL de imagen no permitida." },
        { status: 400 },
      );
    }

    const upstream = await fetch(raw, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CazaOfertaBot/1.0; +https://cazaofertas.es)",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: `No se pudo cargar la imagen (HTTP ${upstream.status}).` },
        { status: 502 },
      );
    }

    const contentType =
      upstream.headers.get("content-type")?.split(";")[0]?.trim() ||
      "image/jpeg";
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
