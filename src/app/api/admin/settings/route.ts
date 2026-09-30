import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { parseFeedUrlsText } from "@/lib/feed-urls";
import {
  type AppSettingsPatch,
  getAppSettings,
  updateAppSettings,
} from "@/services/appSettings";
import {
  getMetaSocialSettings,
  updateMetaSocialSettings,
} from "@/services/metaSocialSettings";
import {
  getRetailerDealSettingsMap,
  RETAILER_DEAL_JOBS,
  type RetailerDealSettingsPatch,
  updateRetailerDealSettings,
} from "@/services/retailerDealSettings";

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

    const [settings, metaSocial, retailerDeals] = await Promise.all([
      getAppSettings(),
      getMetaSocialSettings(),
      getRetailerDealSettingsMap(),
    ]);
    return NextResponse.json({ ok: true, settings, metaSocial, retailerDeals });
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
      "asinScrapeFailThreshold",
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

    const metaPatch: {
      postingEnabled?: boolean;
      minDiscountPercent?: number;
      postIntervalMinutes?: number;
      batchSize?: number;
    } = {};
    const metaPostingEnabled = parseOptionalBoolean(body.metaPostingEnabled);
    if (metaPostingEnabled !== undefined) {
      metaPatch.postingEnabled = metaPostingEnabled;
    }
    const metaMinDiscount = parseOptionalNumber(
      body.metaMinDiscountPercent,
      "metaMinDiscountPercent",
    );
    if (!metaMinDiscount.ok) {
      return NextResponse.json(
        { ok: false, error: metaMinDiscount.error },
        { status: 400 },
      );
    }
    if (metaMinDiscount.value !== undefined) {
      metaPatch.minDiscountPercent = metaMinDiscount.value;
    }
    const metaInterval = parseOptionalNumber(
      body.metaPostIntervalMinutes,
      "metaPostIntervalMinutes",
    );
    if (!metaInterval.ok) {
      return NextResponse.json(
        { ok: false, error: metaInterval.error },
        { status: 400 },
      );
    }
    if (metaInterval.value !== undefined) {
      metaPatch.postIntervalMinutes = metaInterval.value;
    }
    const metaBatchSize = parseOptionalNumber(
      body.metaBatchSize,
      "metaBatchSize",
    );
    if (!metaBatchSize.ok) {
      return NextResponse.json(
        { ok: false, error: metaBatchSize.error },
        { status: 400 },
      );
    }
    if (metaBatchSize.value !== undefined) {
      metaPatch.batchSize = metaBatchSize.value;
    }

    // { carrefour: { enabled, minDiscountPercent, pagesPerFeed, feedUrls, includeMarketplace }, … }
    const retailerPatch: RetailerDealSettingsPatch = {};
    const retailerBody =
      body.retailerDeals && typeof body.retailerDeals === "object"
        ? (body.retailerDeals as Record<string, Record<string, unknown>>)
        : {};
    for (const job of RETAILER_DEAL_JOBS) {
      const raw = retailerBody[job];
      if (!raw || typeof raw !== "object") continue;
      const jobPatch: NonNullable<RetailerDealSettingsPatch[typeof job]> = {};
      for (const field of ["minDiscountPercent", "pagesPerFeed"] as const) {
        const parsed = parseOptionalNumber(raw[field], `${job}.${field}`);
        if (!parsed.ok) {
          return NextResponse.json(
            { ok: false, error: parsed.error },
            { status: 400 },
          );
        }
        if (parsed.value !== undefined) jobPatch[field] = parsed.value;
      }
      for (const field of ["enabled", "includeMarketplace"] as const) {
        const parsed = parseOptionalBoolean(raw[field]);
        if (parsed !== undefined) jobPatch[field] = parsed;
      }
      if (raw.feedUrls !== undefined) {
        jobPatch.feedUrls = parseFeedUrlsText(String(raw.feedUrls ?? ""));
      }
      retailerPatch[job] = jobPatch;
    }

    if (
      Object.keys(patch).length === 0 &&
      Object.keys(metaPatch).length === 0 &&
      Object.keys(retailerPatch).length === 0
    ) {
      return NextResponse.json(
        { ok: false, error: "No hay campos válidos para actualizar." },
        { status: 400 },
      );
    }

    // Secuencial: las tres escrituras tocan la misma fila de app_settings.
    const settings =
      Object.keys(patch).length > 0 ? await updateAppSettings(patch) : await getAppSettings();
    const metaSocial =
      Object.keys(metaPatch).length > 0
        ? await updateMetaSocialSettings(metaPatch)
        : await getMetaSocialSettings();
    const retailerDeals =
      Object.keys(retailerPatch).length > 0
        ? await updateRetailerDealSettings(retailerPatch)
        : await getRetailerDealSettingsMap();
    return NextResponse.json({ ok: true, settings, metaSocial, retailerDeals });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
