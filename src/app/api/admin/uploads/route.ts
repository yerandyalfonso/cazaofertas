import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { createSupabaseServiceClient, getPublicStorageUrl } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Adjunta un archivo de imagen (campo file)." },
        { status: 400 },
      );
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Formato no permitido. Usa JPG, PNG, WebP o GIF." },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "La imagen supera 5 MB." },
        { status: 400 },
      );
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";
    const path = `featured/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const client = createSupabaseServiceClient();

    const { error: uploadError } = await client.storage
      .from("article-images")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      // Fallback: data URL (útil si el bucket aún no existe).
      const base64 = buffer.toString("base64");
      const dataUrl = `data:${file.type};base64,${base64}`;
      return NextResponse.json({
        ok: true,
        url: dataUrl,
        storage: "data-url",
        warning:
          uploadError.message.includes("Bucket") ||
          uploadError.message.includes("not found")
            ? "Bucket article-images no disponible: se guardó como data URL. Aplica la migración 0007."
            : `Storage: ${uploadError.message}. Se usó data URL.`,
      });
    }

    const url = getPublicStorageUrl("article-images", path);

    return NextResponse.json({
      ok: true,
      url,
      storage: "supabase",
      path,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
