import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { parseFeedUrlsText } from "@/lib/feed-urls";
import {
  type AppSettingsPatch,
  getAppSettings,
  updateAppSettings,
} from "@/services/appSettings";

export const runtime = "nodejs";

function parseNumber(
  value: unknown,
  field: string,
): { ok: true; value: number } | { ok: false; error: string } {
  if (value === undefined || value === "") {
    return { ok: false, error: `${field} es obligatorio.` };
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: `${field} no es un número válido.` };
  }
  return { ok: true, value: parsed };
}

function parseOptionalNumber(
  value: unknown,
  field: string,
): { ok: true; value?: number } | { ok: false; error: string } {
  if (value === undefined || value === "") return { ok: true };
  return parseNumber(value, field);
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "1" || value === "true" || value === "on") return true;
  if (value === "0" || value === "false" || value === "off") return false;
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const settings = await getAppSettings();
    return NextResponse.json({ ok: true, settings });
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

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const patch: AppSettingsPatch = {};
    const numericFields: Array<keyof AppSettingsPatch> = [
      "telegramMinDiscountPercent",
      "telegramBatchHours",
      "telegramFlushRescheduleMinutes",
      "telegramFlushLimit",
      "amazonFlashInsertLimit",
      "amazonDepartmentFeedsPerRun",
      "miraviaMinDiscountPercent",
      "miraviaDiscoveryMaxItems",
      "miraviaFlashLimit",
      "miraviaFlashUpdateLimit",
      "miraviaFeedsPerRun",
      "kiabiMinDiscountPercent",
      "kiabiDiscoveryMaxItems",
      "kiabiFeedsPerRun",
    ];

    for (const field of numericFields) {
      const parsed = parseOptionalNumber(body[field], field);
      if (!parsed.ok) {
        return NextResponse.json(
          { ok: false, error: parsed.error },
          { status: 400 },
        );
      }
      if (parsed.value !== undefined) {
        patch[field] = parsed.value as never;
      }
    }

    if (body.amazonAssociateTag !== undefined) {
      patch.amazonAssociateTag = String(body.amazonAssociateTag ?? "").trim();
    }

    const feedFields = [
      "amazonFlashFeedUrls",
      "miraviaFeedUrls",
      "kiabiFeedUrls",
    ] as const;
    for (const field of feedFields) {
      if (body[field] !== undefined) {
        patch[field] = parseFeedUrlsText(String(body[field] ?? ""));
      }
    }

    const boolFields = [
      "miraviaDealsEnabled",
      "kiabiDealsEnabled",
      "kiabiNewProductsOnly",
    ] as const;
    for (const field of boolFields) {
      const parsed = parseOptionalBoolean(body[field]);
      if (parsed !== undefined) patch[field] = parsed;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No hay campos válidos para actualizar." },
        { status: 400 },
      );
    }

    const settings = await updateAppSettings(patch);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
