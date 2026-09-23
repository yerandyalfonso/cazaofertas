import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface FlashAsinCooldownEntry {
  until: string;
  reason: string;
}

type CooldownFile = Record<string, FlashAsinCooldownEntry>;

const DEFAULT_HOURS = 12;

function resolveCooldownPath(): string {
  const inRepo = path.join(
    process.cwd(),
    "scripts/local-cron/.flash-asin-cooldown.json",
  );
  if (!process.env.VERCEL) return inRepo;
  return path.join(os.tmpdir(), "cazaofertas-flash-asin-cooldown.json");
}

async function readFile(): Promise<CooldownFile> {
  try {
    const raw = await fs.readFile(resolveCooldownPath(), "utf8");
    const parsed = JSON.parse(raw) as CooldownFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeFile(data: CooldownFile): Promise<void> {
  const filePath = resolveCooldownPath();
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  } catch (error) {
    console.warn(
      "[flash-cooldown] no se pudo guardar",
      error instanceof Error ? error.message : error,
    );
  }
}

function pruneExpired(data: CooldownFile, now = Date.now()): CooldownFile {
  const next: CooldownFile = {};
  for (const [asin, entry] of Object.entries(data)) {
    if (!entry?.until) continue;
    if (new Date(entry.until).getTime() > now) {
      next[asin.toUpperCase()] = entry;
    }
  }
  return next;
}

/** ASINs que no debemos reintentar hasta `until`. */
export async function getActiveFlashAsinCooldowns(): Promise<
  Map<string, FlashAsinCooldownEntry>
> {
  const pruned = pruneExpired(await readFile());
  return new Map(Object.entries(pruned));
}

export async function addFlashAsinCooldown(
  asin: string,
  options?: { hours?: number; reason?: string },
): Promise<void> {
  const key = asin.trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(key)) return;

  const hours =
    options?.hours && options.hours > 0 ? options.hours : DEFAULT_HOURS;
  const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const data = pruneExpired(await readFile());
  data[key] = {
    until,
    reason: options?.reason?.trim() || "no-buybox",
  };
  await writeFile(data);
}

/** Igual que addFlashAsinCooldown pero para muchos ASINs en una sola escritura. */
export async function addFlashAsinCooldowns(
  asins: string[],
  options?: { hours?: number; reason?: string },
): Promise<void> {
  const keys = asins
    .map((asin) => asin.trim().toUpperCase())
    .filter((key) => /^[A-Z0-9]{10}$/.test(key));
  if (keys.length === 0) return;

  const hours =
    options?.hours && options.hours > 0 ? options.hours : DEFAULT_HOURS;
  const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const reason = options?.reason?.trim() || "no-buybox";
  const data = pruneExpired(await readFile());
  for (const key of keys) {
    // No acortar un cooldown más largo ya existente.
    const current = data[key];
    if (current && new Date(current.until).getTime() > Date.parse(until)) continue;
    data[key] = { until, reason };
  }
  await writeFile(data);
}
