import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name");

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, categories: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      slug?: string;
      description?: string;
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { ok: false, error: "El nombre de la categoría es obligatorio." },
        { status: 400 },
      );
    }

    const slug = (body.slug?.trim() || slugify(name)).slice(0, 80);
    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "No se pudo generar un slug válido." },
        { status: 400 },
      );
    }

    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("categories")
      .upsert(
        {
          name,
          slug,
          description: body.description?.trim() || null,
          is_active: true,
        },
        { onConflict: "slug" },
      )
      .select("id, name, slug")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, category: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
