import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import {
  createCategoryKeyword,
  deleteCategoryKeyword,
  listCategoryKeywords,
  updateCategoryKeyword,
} from "@/services/categoryKeywords";

export const runtime = "nodejs";

type KeywordBody = {
  id?: string;
  keywords?: string | string[];
  breadcrumbPatterns?: string | string[];
  /** @deprecated usar keywords */
  keyword?: string;
  categoryId?: string;
  isActive?: boolean;
  notes?: string | null;
};

function bodyKeywords(body: KeywordBody): string | string[] | undefined {
  if (body.keywords !== undefined) return body.keywords;
  if (body.keyword !== undefined) return body.keyword;
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const includeInactive =
      request.nextUrl.searchParams.get("all") === "1" ||
      request.nextUrl.searchParams.get("includeInactive") === "1";

    const keywords = await listCategoryKeywords({ includeInactive });
    return NextResponse.json({ ok: true, keywords });
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

    const body = (await request.json()) as KeywordBody;
    const categoryId = body.categoryId?.trim();

    if (!categoryId) {
      return NextResponse.json(
        { ok: false, error: "Falta categoryId." },
        { status: 400 },
      );
    }

    const created = await createCategoryKeyword({
      keywords: bodyKeywords(body) ?? "",
      breadcrumbPatterns: body.breadcrumbPatterns ?? "",
      categoryId,
      isActive: body.isActive !== false,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ ok: true, keyword: created });
  } catch (error) {
    const message = formatEnvError(error);
    const status = /ya existe|al menos|Falta/i.test(message) ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const body = (await request.json()) as KeywordBody;
    if (!body.id?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Falta id." },
        { status: 400 },
      );
    }

    const updated = await updateCategoryKeyword({
      id: body.id,
      keywords: bodyKeywords(body),
      breadcrumbPatterns: body.breadcrumbPatterns,
      categoryId: body.categoryId,
      isActive: body.isActive,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true, keyword: updated });
  } catch (error) {
    const message = formatEnvError(error);
    const status = /ya existe|al menos|Falta/i.test(message) ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Falta id." },
        { status: 400 },
      );
    }

    await deleteCategoryKeyword(id);
    return NextResponse.json({ ok: true, deleted: 1 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
