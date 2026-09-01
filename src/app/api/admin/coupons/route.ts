import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

type CouponUpdate = Database["public"]["Tables"]["coupons"]["Update"];

type CouponBody = {
  id?: string;
  retailer?: string;
  title?: string;
  code?: string;
  description?: string;
  terms?: string;
  url?: string;
  startsAt?: string | null;
  expiresAt?: string | null;
  highlight?: boolean;
  isActive?: boolean;
  source?: string;
};

function emptyToNull(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("coupons")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, coupons: data ?? [] });
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

    const body = (await request.json()) as CouponBody;
    const retailer = body.retailer?.trim().toLowerCase();
    const title = body.title?.trim();
    const code = body.code?.trim().toUpperCase();
    const url = body.url?.trim();

    if (!retailer || !title || !code || !url) {
      return NextResponse.json(
        { ok: false, error: "Faltan retailer, title, code o url." },
        { status: 400 },
      );
    }

    const client = createSupabaseServiceClient();
    const row = {
      retailer,
      title,
      code,
      description: body.description?.trim() || "",
      terms: body.terms?.trim() || "",
      url,
      starts_at: emptyToNull(body.startsAt),
      expires_at: emptyToNull(body.expiresAt),
      highlight: Boolean(body.highlight),
      is_active: body.isActive !== false,
      source: body.source?.trim() || "manual",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from("coupons")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, coupon: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const body = (await request.json()) as CouponBody;
    if (!body.id) {
      return NextResponse.json(
        { ok: false, error: "Falta id." },
        { status: 400 },
      );
    }

    const patch: CouponUpdate = {
      updated_at: new Date().toISOString(),
    };
    if (body.retailer !== undefined) {
      patch.retailer = body.retailer.trim().toLowerCase();
    }
    if (body.title !== undefined) patch.title = body.title.trim();
    if (body.code !== undefined) patch.code = body.code.trim().toUpperCase();
    if (body.description !== undefined) {
      patch.description = body.description.trim();
    }
    if (body.terms !== undefined) patch.terms = body.terms.trim();
    if (body.url !== undefined) patch.url = body.url.trim();
    if (body.startsAt !== undefined) patch.starts_at = emptyToNull(body.startsAt);
    if (body.expiresAt !== undefined) {
      patch.expires_at = emptyToNull(body.expiresAt);
    }
    if (body.highlight !== undefined) patch.highlight = Boolean(body.highlight);
    if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);
    if (body.source !== undefined) {
      patch.source = body.source.trim() || "manual";
    }

    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("coupons")
      .update(patch)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, coupon: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const client = createSupabaseServiceClient();
    const id = request.nextUrl.searchParams.get("id")?.trim();
    const idsParam = request.nextUrl.searchParams.get("ids")?.trim();

    let ids: string[] = [];
    if (idsParam) {
      ids = idsParam
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    } else if (id) {
      ids = [id];
    } else {
      const body = (await request.json().catch(() => null)) as {
        ids?: string[];
      } | null;
      if (body?.ids?.length) {
        ids = body.ids.map((v) => String(v).trim()).filter(Boolean);
      }
    }

    if (ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Falta id o ids." },
        { status: 400 },
      );
    }

    const { error } = await client.from("coupons").delete().in("id", ids);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
