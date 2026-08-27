/**
 * Pausa preventiva de crons ante denegaciones / anti-bot de Amazon.
 * Estado en `cron_control` (una fila `default`).
 */

import { createSupabaseServiceClient } from "@/lib/supabase";

export const CRON_CONTROL_ID = "default";

/** Minutos de pausa por defecto tras denegaciones. */
export const DEFAULT_PAUSE_MINUTES = Number.parseInt(
  process.env.CRON_PAUSE_MINUTES ?? "90",
  10,
);

export interface CronControlState {
  id: string;
  pausedUntil: string | null;
  pauseReason: string | null;
  consecutiveDenials: number;
  lastDenialAt: string | null;
  lastSuccessAt: string | null;
  updatedAt: string;
  /** true si ahora mismo los crons deben saltarse. */
  isPaused: boolean;
}

type CronControlRow = {
  id: string;
  paused_until: string | null;
  pause_reason: string | null;
  consecutive_denials: number;
  last_denial_at: string | null;
  last_success_at: string | null;
  updated_at: string;
};

function mapRow(row: CronControlRow): CronControlState {
  const pausedUntil = row.paused_until;
  const isPaused = Boolean(
    pausedUntil && new Date(pausedUntil).getTime() > Date.now(),
  );
  return {
    id: row.id,
    pausedUntil,
    pauseReason: row.pause_reason,
    consecutiveDenials: row.consecutive_denials ?? 0,
    lastDenialAt: row.last_denial_at,
    lastSuccessAt: row.last_success_at,
    updatedAt: row.updated_at,
    isPaused,
  };
}

export function isAmazonDenialMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("anti-bot") ||
    m.includes("bloqueado") ||
    m.includes("robot check") ||
    m.includes("http 503") ||
    m.includes("http 429") ||
    m.includes("temporalmente no disponible") ||
    m.includes("challenge")
  );
}

async function ensureRow(
  client: ReturnType<typeof createSupabaseServiceClient>,
): Promise<CronControlRow> {
  const { data, error } = await client
    .from("cron_control")
    .select("*")
    .eq("id", CRON_CONTROL_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`cron_control: ${error.message}`);
  }
  if (data) return data as CronControlRow;

  const { data: inserted, error: insertError } = await client
    .from("cron_control")
    .insert({ id: CRON_CONTROL_ID })
    .select("*")
    .single();

  if (insertError) {
    throw new Error(`cron_control insert: ${insertError.message}`);
  }
  return inserted as CronControlRow;
}

export async function getCronControlState(): Promise<CronControlState> {
  const client = createSupabaseServiceClient();
  const row = await ensureRow(client);
  return mapRow(row);
}

/** Si está en pausa, lanza (salvo force). */
export async function assertCronAllowed(options?: {
  force?: boolean;
}): Promise<CronControlState> {
  const state = await getCronControlState();
  if (!options?.force && state.isPaused) {
    const until = state.pausedUntil
      ? new Date(state.pausedUntil).toLocaleString("es-ES")
      : "—";
    throw new Error(
      `Cron en pausa preventiva hasta ${until}. Motivo: ${
        state.pauseReason ?? "denegaciones Amazon"
      }. Usa force=1 o reanuda desde admin.`,
    );
  }
  return state;
}

export async function pauseCronJobs(options: {
  minutes?: number;
  reason: string;
}): Promise<CronControlState> {
  const client = createSupabaseServiceClient();
  const minutes =
    Number.isFinite(options.minutes) && (options.minutes as number) > 0
      ? (options.minutes as number)
      : Number.isFinite(DEFAULT_PAUSE_MINUTES) && DEFAULT_PAUSE_MINUTES > 0
        ? DEFAULT_PAUSE_MINUTES
        : 90;
  const now = new Date();
  const until = new Date(now.getTime() + minutes * 60_000).toISOString();

  const current = await ensureRow(client);
  const { data, error } = await client
    .from("cron_control")
    .update({
      paused_until: until,
      pause_reason: options.reason.slice(0, 500),
      consecutive_denials: (current.consecutive_denials ?? 0) + 1,
      last_denial_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", CRON_CONTROL_ID)
    .select("*")
    .single();

  if (error) throw new Error(`pause cron: ${error.message}`);
  console.warn("[cron] Pausado hasta", until, "—", options.reason);
  return mapRow(data as CronControlRow);
}

export async function resumeCronJobs(): Promise<CronControlState> {
  const client = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("cron_control")
    .update({
      paused_until: null,
      pause_reason: null,
      consecutive_denials: 0,
      updated_at: now,
    })
    .eq("id", CRON_CONTROL_ID)
    .select("*")
    .single();

  if (error) throw new Error(`resume cron: ${error.message}`);
  return mapRow(data as CronControlRow);
}

export async function recordCronSuccess(): Promise<void> {
  const client = createSupabaseServiceClient();
  const now = new Date().toISOString();
  await client
    .from("cron_control")
    .update({
      consecutive_denials: 0,
      last_success_at: now,
      updated_at: now,
    })
    .eq("id", CRON_CONTROL_ID);
}

/**
 * Tras un lote: si hay bastantes denegaciones Amazon, pausa los crons.
 * Devuelve true si se activó la pausa.
 */
export async function maybePauseAfterAmazonErrors(
  errors: Array<{ message: string }>,
  processed: number,
): Promise<{ paused: boolean; denials: number; state?: CronControlState }> {
  const denials = errors.filter((e) => isAmazonDenialMessage(e.message));
  if (denials.length === 0) {
    if (processed > 0) await recordCronSuccess();
    return { paused: false, denials: 0 };
  }

  const rate = denials.length / Math.max(processed, 1);
  const shouldPause =
    denials.length >= 2 || (denials.length >= 1 && rate >= 0.4);

  if (!shouldPause) {
    const client = createSupabaseServiceClient();
    const current = await ensureRow(client);
    await client
      .from("cron_control")
      .update({
        consecutive_denials: (current.consecutive_denials ?? 0) + 1,
        last_denial_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", CRON_CONTROL_ID);

    const next = (current.consecutive_denials ?? 0) + 1;
    if (next >= 2) {
      const state = await pauseCronJobs({
        reason: `Denegaciones Amazon repetidas (${denials.length} en este lote, ${next} rachas).`,
      });
      return { paused: true, denials: denials.length, state };
    }
    return { paused: false, denials: denials.length };
  }

  const state = await pauseCronJobs({
    reason: `Amazon denegó ${denials.length}/${processed} fichas (anti-bot / 429 / 503).`,
  });
  return { paused: true, denials: denials.length, state };
}
