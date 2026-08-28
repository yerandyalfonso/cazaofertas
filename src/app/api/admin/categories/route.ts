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
    const includeAll =
      request.nextUrl.searchParams.get("all") === "1" ||
      request.nextUrl.searchParams.get("includeInactive") === "1";

    const client = createSupabaseServiceClient();
    let query = client
      .from("categories")
      .select("id, name, slug, description, image_url, is_active, created_at")
      .order("name");

    if (!includeAll) {
      query = query.eq("is_active", true);
    }

    const { data: categories, error } = await query;
    if (error) throw new Error(error.message);

    const rows = categories ?? [];
    const counts = new Map<string, number>();

    if (includeAll && rows.length > 0) {
      const { data: products, error: productsError } = await client
        .from("products")
        .select("category_id")
        .not("category_id", "is", null);

      if (productsError) throw new Error(productsError.message);

      for (const row of products ?? []) {
        if (!row.category_id) continue;
        counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
      }
    }

    const payload = includeAll
      ? rows.map((row) => ({
          ...row,
          productCount: counts.get(row.id) ?? 0,
        }))
      : rows.map(({ id, name, slug }) => ({ id, name, slug }));

    return NextResponse.json({ ok: true, categories: payload });
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
      image_url?: string;
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
          image_url: body.image_url?.trim() || null,
          is_active: true,
        },
        { onConflict: "slug" },
      )
      .select("id, name, slug, description, image_url, is_active")
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
