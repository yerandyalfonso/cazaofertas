import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase";
import type { Json } from "@/types/database";

export const runtime = "nodejs";

const KINDS = new Set(["card", "carousel", "video"]);

type ProjectBody = {
  id?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
};

function parseKind(value: string | null): string | null {
  return value && KINDS.has(value) ? value : null;
}

function errorResponse(error: unknown) {
  return NextResponse.json(
    { ok: false, error: formatEnvError(error) },
    { status: 500 },
  );
}

/** GET ?kind=card → { projects: [...] } (el JSON completo de cada proyecto). */
export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const kind = parseKind(request.nextUrl.searchParams.get("kind"));
    if (!kind) {
      return NextResponse.json(
        { ok: false, error: "kind no válido." },
        { status: 400 },
      );
    }

    const { data, error } = await createSupabaseServiceClient()
      .from("design_projects")
      .select("data")
      .eq("kind", kind)
      .order("updated_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      projects: (data ?? []).map((row) => row.data),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PUT { kind, projects: [...] } → upsert por id. */
export async function PUT(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const body = (await request.json()) as {
      kind?: string;
      projects?: ProjectBody[];
    };
    const kind = parseKind(body.kind ?? null);
    const projects = Array.isArray(body.projects) ? body.projects : [];
    if (!kind || projects.some((p) => !p?.id || !p?.name)) {
      return NextResponse.json(
        { ok: false, error: "Faltan kind, id o name." },
        { status: 400 },
      );
    }
    if (projects.length === 0) return NextResponse.json({ ok: true });

    const now = new Date().toISOString();
    const { error } = await createSupabaseServiceClient()
      .from("design_projects")
      .upsert(
        projects.map((project) => ({
          id: project.id!,
          kind,
          name: project.name!,
          data: project as Json,
          created_at: project.createdAt ?? now,
          updated_at: project.updatedAt ?? now,
        })),
      );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE ?kind=card&id=... */
export async function DELETE(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const kind = parseKind(request.nextUrl.searchParams.get("kind"));
    const id = request.nextUrl.searchParams.get("id");
    if (!kind || !id) {
      return NextResponse.json(
        { ok: false, error: "Faltan kind o id." },
        { status: 400 },
      );
    }

    const { error } = await createSupabaseServiceClient()
      .from("design_projects")
      .delete()
      .eq("kind", kind)
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
