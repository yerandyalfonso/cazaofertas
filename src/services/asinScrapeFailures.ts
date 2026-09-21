/**
 * Estado local de fallos de scrape por ASIN (cron Mac).
 * Evita spamear Telegram con el mismo error y permite auto-pausar productos
 * que fallan de forma persistente.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  resolveAsinScrapeFailThreshold,
  resolveAsinScrapeFailThresholdSync,
} from "@/services/appSettings";

export interface AsinFailureRecord {
  asin: string;
  message: string;
  count: number;
  firstFailedAt: string;
  lastFailedAt: string;
  lastNotifiedAt: string | null;
  /** Ya se aplicó la medida (p.ej. desactivar). */
  actionTakenAt: string | null;
}

interface FailureStore {
  updatedAt: string;
  byAsin: Record<string, AsinFailureRecord>;
}

/** Avisar de nuevo el mismo ASIN solo tras este intervalo (salvo umbral de persistencia). */
const RENOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** @deprecated Preferir resolveAsinScrapeFailThreshold(); valor sync para mensajes. */
export function getPersistFailureThreshold(): number {
  return resolveAsinScrapeFailThresholdSync();
}

/** Alias legacy (cron notify). */
export const PERSIST_FAILURE_THRESHOLD = getPersistFailureThreshold();

function storePath(): string {
  const logDir =
    process.env.CAZAOFERTAS_CRON_LOG_DIR?.trim() ||
    resolve(process.cwd(), "data");
  return resolve(logDir, "asin-scrape-failures.json");
}

async function loadStore(): Promise<FailureStore> {
  try {
    const raw = await readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as FailureStore;
    if (parsed && typeof parsed.byAsin === "object" && parsed.byAsin) {
      return parsed;
    }
  } catch {
    // missing / corrupt → empty
  }
  return { updatedAt: new Date().toISOString(), byAsin: {} };
}

async function saveStore(store: FailureStore): Promise<void> {
  const path = storePath();
  await mkdir(dirname(path), { recursive: true });
  store.updatedAt = new Date().toISOString();
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export async function clearAsinScrapeFailure(asin: string): Promise<void> {
  const key = asin.trim().toUpperCase();
  if (!key) return;
  const store = await loadStore();
  if (!(key in store.byAsin)) return;
  delete store.byAsin[key];
  await saveStore(store);
}

export type AsinFailureDecision =
  | { notify: false; record: AsinFailureRecord }
  | {
      notify: true;
      record: AsinFailureRecord;
      reason: "first" | "persistent" | "renotify";
      shouldDeactivate: boolean;
    };

/**
 * Registra un fallo y decide si hay que avisar por Telegram.
 * - 1.er fallo → avisar
 * - fallos intermedios → silencio (el ASIN ya rotó en catálogo)
 * - umbral persistente → avisar + marcar para desactivar
 * - tras cooldown → reavisar si sigue fallando
 */
export async function recordAsinScrapeFailure(
  asin: string,
  message: string,
): Promise<AsinFailureDecision> {
  const key = asin.trim().toUpperCase();
  const now = new Date();
  const nowIso = now.toISOString();
  const threshold = await resolveAsinScrapeFailThreshold();
  const store = await loadStore();
  const prev = store.byAsin[key];
  const record: AsinFailureRecord = prev
    ? {
        ...prev,
        message: message.slice(0, 280),
        count: prev.count + 1,
        lastFailedAt: nowIso,
      }
    : {
        asin: key,
        message: message.slice(0, 280),
        count: 1,
        firstFailedAt: nowIso,
        lastFailedAt: nowIso,
        lastNotifiedAt: null,
        actionTakenAt: null,
      };

  store.byAsin[key] = record;

  const lastNotifiedMs = record.lastNotifiedAt
    ? new Date(record.lastNotifiedAt).getTime()
    : 0;
  const cooledDown =
    !record.lastNotifiedAt ||
    now.getTime() - lastNotifiedMs >= RENOTIFY_COOLDOWN_MS;

  let decision: AsinFailureDecision;
  if (record.count === 1) {
    decision = {
      notify: true,
      record,
      reason: "first",
      shouldDeactivate: false,
    };
  } else if (record.count >= threshold && !record.actionTakenAt) {
    decision = {
      notify: true,
      record,
      reason: "persistent",
      shouldDeactivate: true,
    };
  } else if (cooledDown && record.count >= 2) {
    decision = {
      notify: true,
      record,
      reason: "renotify",
      shouldDeactivate: false,
    };
  } else {
    decision = { notify: false, record };
  }

  if (decision.notify) {
    record.lastNotifiedAt = nowIso;
    store.byAsin[key] = record;
  }
  await saveStore(store);
  return decision;
}

export async function markAsinFailureActionTaken(asin: string): Promise<void> {
  const key = asin.trim().toUpperCase();
  const store = await loadStore();
  const record = store.byAsin[key];
  if (!record) return;
  record.actionTakenAt = new Date().toISOString();
  store.byAsin[key] = record;
  await saveStore(store);
}
