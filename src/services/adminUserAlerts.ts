/**
 * Alertas de usuario (bot de Telegram) para el admin: listado con usuario,
 * producto y tienda, resumen y últimas pasadas de `user-alerts`.
 */

import { detectRetailerFromUrl, requiresResidentialIp } from "@/lib/retailers";
import { createSupabaseServiceClient } from "@/lib/supabase";

export type AdminAlertKind = "url" | "category" | "brand" | "keyword";

export interface AdminUserAlert {
  id: string;
  kind: AdminAlertKind;
  /** URL, categoría, marca o palabra clave según el tipo. */
  target: string;
  retailer: string | null;
  productTitle: string | null;
  userLabel: string;
  isTestUser: boolean;
  isActive: boolean;
  /** Alerta de URL sin producto vinculado que solo puede completar el Mac. */
  waitingForMac: boolean;
  failCount: number;
  lastKnownPrice: number | null;
  lastNotifiedPrice: number | null;
  maxPrice: number | null;
  minDiscountPercentage: number | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface AdminAlertRun {
  id: number;
  machine: string;
  finishedAt: string;
  checked: number;
  failed: number;
  skipped: number;
  priceDrops: number;
  notified: number;
}

const PAGE_SIZE = 1000;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function listAdminUserAlerts(): Promise<AdminUserAlert[]> {
  const client = createSupabaseServiceClient();
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from("alerts")
      .select(
        "id, user_id, category_id, product_id, brand, keyword, url, is_active, fail_count, last_known_price, last_notified_price, max_price, min_discount_percentage, last_checked_at, created_at",
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const productIds = [...new Set(rows.map((row) => row.product_id).filter((id): id is string => !!id))];
  const categoryIds = [
    ...new Set(rows.map((row) => row.category_id).filter((id): id is string => !!id)),
  ];

  const users = new Map<string, { label: string; isTest: boolean }>();
  for (const chunk of chunks(userIds, 200)) {
    const { data, error } = await client
      .from("users")
      .select("id, telegram_username, telegram_id, email, is_test")
      .in("id", chunk);
    if (error) throw new Error(error.message);
    for (const user of data ?? []) {
      users.set(user.id, {
        label: user.telegram_username
          ? `@${user.telegram_username}`
          : user.email ?? (user.telegram_id ? `Telegram ${user.telegram_id}` : "Sin nombre"),
        isTest: user.is_test,
      });
    }
  }

  const products = new Map<string, { title: string; retailer: string | null }>();
  for (const chunk of chunks(productIds, 200)) {
    const { data, error } = await client.from("products").select("id, title, retailer").in("id", chunk);
    if (error) throw new Error(error.message);
    for (const product of data ?? []) {
      products.set(product.id, { title: product.title, retailer: product.retailer });
    }
  }

  const categories = new Map<string, string>();
  if (categoryIds.length) {
    const { data, error } = await client.from("categories").select("id, name").in("id", categoryIds);
    if (error) throw new Error(error.message);
    for (const category of data ?? []) categories.set(category.id, category.name);
  }

  return rows.map((row) => {
    const product = row.product_id ? products.get(row.product_id) : undefined;
    const kind: AdminAlertKind = row.url
      ? "url"
      : row.category_id
        ? "category"
        : row.brand
          ? "brand"
          : "keyword";
    const retailer =
      product?.retailer ?? (row.url ? detectRetailerFromUrl(row.url) : null) ?? null;
    const user = users.get(row.user_id);
    return {
      id: row.id,
      kind,
      target:
        kind === "url"
          ? row.url!
          : kind === "category"
            ? (categories.get(row.category_id!) ?? "Categoría borrada")
            : kind === "brand"
              ? row.brand!
              : (row.keyword ?? ""),
      retailer,
      productTitle: product?.title ?? null,
      userLabel: user?.label ?? "Usuario borrado",
      isTestUser: user?.isTest ?? false,
      isActive: row.is_active,
      waitingForMac:
        kind === "url" &&
        row.is_active &&
        !row.product_id &&
        !!retailer &&
        requiresResidentialIp(retailer as Parameters<typeof requiresResidentialIp>[0]),
      failCount: row.fail_count,
      lastKnownPrice: row.last_known_price,
      lastNotifiedPrice: row.last_notified_price,
      maxPrice: row.max_price,
      minDiscountPercentage: row.min_discount_percentage,
      lastCheckedAt: row.last_checked_at,
      createdAt: row.created_at,
    };
  });
}

export async function listAdminAlertRuns(limit = 12): Promise<AdminAlertRun[]> {
  const client = createSupabaseServiceClient();
  const { data, error } = await client
    .from("user_alert_runs")
    .select("id, machine, finished_at, checked, failed, skipped, price_drops, notified")
    .order("finished_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    machine: row.machine,
    finishedAt: row.finished_at,
    checked: row.checked,
    failed: row.failed,
    skipped: row.skipped,
    priceDrops: row.price_drops,
    notified: row.notified,
  }));
}

/** Pausa o reactiva una alerta. Al reactivar se limpia el contador de fallos. */
export async function setAdminAlertActive(id: string, isActive: boolean): Promise<void> {
  const client = createSupabaseServiceClient();
  const { error } = await client
    .from("alerts")
    .update({
      is_active: isActive,
      ...(isActive ? { fail_count: 0, first_failed_at: null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
