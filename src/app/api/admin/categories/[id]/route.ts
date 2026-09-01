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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      slug?: string;
      description?: string;
      image_url?: string;
      is_active?: boolean;
      show_in_blog?: boolean;
    };

    const patch: {
      name?: string;
      slug?: string;
      description?: string | null;
      image_url?: string | null;
      is_active?: boolean;
      show_in_blog?: boolean;
    } = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { ok: false, error: "El nombre no puede estar vacío." },
          { status: 400 },
        );
      }
      patch.name = name;
    }
    if (body.slug !== undefined) {
      const slug = slugify(body.slug);
      if (!slug) {
        return NextResponse.json(
          { ok: false, error: "Slug inválido." },
          { status: 400 },
        );
      }
      patch.slug = slug;
    }
    if (body.description !== undefined) {
      patch.description = body.description.trim() || null;
    }
    if (body.image_url !== undefined) {
      patch.image_url = body.image_url.trim() || null;
    }
    if (body.is_active !== undefined) {
      patch.is_active = Boolean(body.is_active);
    }
    if (body.show_in_blog !== undefined) {
      patch.show_in_blog = Boolean(body.show_in_blog);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No hay cambios que aplicar." },
        { status: 400 },
      );
    }

    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("categories")
      .update(patch)
      .eq("id", id)
      .select(
        "id, name, slug, description, image_url, is_active, created_at, parent_id, show_in_blog",
      )
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const { id } = await context.params;
    const client = createSupabaseServiceClient();

    const { count, error: countError } = await client
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if (countError) throw new Error(countError.message);

    if ((count ?? 0) > 0) {
      const { data, error } = await client
        .from("categories")
        .update({ is_active: false })
        .eq("id", id)
        .select("id, name, slug, is_active")
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({
        ok: true,
        softDeleted: true,
        category: data,
      });
    }

    const { error } = await client.from("categories").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, softDeleted: false });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
