/**
 * Catálogo de cupones Miravia (Centro de cupones).
 * La lista se hidrata por JS (mtop); usamos Chrome headless + CDP.
 *
 * URL:
 * https://www.miravia.es/ch/coupon-catalogue/coupon-catalogue
 */

import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DiscoveredCoupon } from "./types";

export const MIRAVIA_COUPON_CATALOGUE_URL =
  process.env.MIRAVIA_COUPON_CATALOGUE_URL?.trim() ||
  "https://www.miravia.es/ch/coupon-catalogue/coupon-catalogue";

const TAG_UNION_ID = 190925071601;
const APP_KEY = "24677475";
const DEFAULT_POOL_ID = 45;
const PAGE_SIZE = 12;
const MAX_PAGES = Math.min(
  Number(process.env.MIRAVIA_COUPON_MAX_PAGES ?? "8") || 8,
  30,
);

type BenefitVO = {
  benefitId?: number | string;
  title?: string;
  subTitle?: string;
  valueDesc?: string;
  value?: string;
  discountType?: number;
  discountValue?: number;
  discountInfo?: { value?: string; title?: string };
  timeline?: string;
  actionUrl?: string;
  sellerInfo?: {
    storeName?: string;
    landingUrl?: string;
    sellerId?: number | string;
  };
  originalData?: {
    thresholdText?: string;
    termsAndConditions?: Array<{ content?: string | null }>;
    sellerInfo?: { storeName?: string; landingUrl?: string };
  };
  voucherLegacyInfo?: {
    termsAndConditions?: Array<{ content?: string | null }>;
  };
};

function chromePath(): string | null {
  const candidates = [
    process.env.CHROME_PATH?.trim(),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function slugCode(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  return `MV-${slug || "CUPON"}`.slice(0, 32);
}

function absolutize(url?: string | null): string {
  if (!url?.trim()) return MIRAVIA_COUPON_CATALOGUE_URL;
  const t = url.trim();
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("http")) return t;
  if (t.startsWith("/")) return `https://www.miravia.es${t}`;
  return MIRAVIA_COUPON_CATALOGUE_URL;
}

function parseTimeline(timeline?: string): {
  startsAt?: string;
  expiresAt?: string;
} {
  if (!timeline) return {};
  const m = timeline.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  );
  if (!m) return {};
  return {
    startsAt: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`,
    expiresAt: `${m[6]}-${m[5].padStart(2, "0")}-${m[4].padStart(2, "0")}`,
  };
}

function termsFromBenefit(b: BenefitVO): string {
  const parts: string[] = [];
  if (b.valueDesc) parts.push(b.valueDesc);
  if (b.subTitle) parts.push(b.subTitle);
  if (b.timeline) parts.push(`Vigencia: ${b.timeline}`);
  const terms =
    b.originalData?.termsAndConditions ??
    b.voucherLegacyInfo?.termsAndConditions ??
    [];
  for (const t of terms) {
    const c = t?.content?.trim();
    if (c) parts.push(c);
  }
  parts.push(
    "Cupón Miravia de tienda: recógelo en el Centro de cupones («¡Lo quiero!») y se aplica al pagar. Sujeto a stock y TyC de Miravia.",
  );
  return parts.join("\n").slice(0, 1200);
}

function benefitToCoupon(b: BenefitVO): DiscoveredCoupon | null {
  const store =
    b.sellerInfo?.storeName?.trim() ||
    b.originalData?.sellerInfo?.storeName?.trim() ||
    "Miravia";
  const discount =
    b.discountInfo?.value?.trim() ||
    (b.discountType === 2
      ? `${b.discountValue}%`
      : b.discountValue != null
        ? `${(Number(b.discountValue) / 100).toFixed(2)}€`
        : b.value?.replace(/^DTO\.?/i, "").trim()) ||
    "";
  const titleBase = b.title?.trim() || "Cupón de tienda";
  const title = `${discount ? `${discount} · ` : ""}${titleBase} · ${store}`.slice(
    0,
    120,
  );
  const id = String(b.benefitId ?? b.sellerInfo?.sellerId ?? slugCode(store));
  const code = slugCode(`${discount}-${store}-${id}`.slice(0, 40));
  const { startsAt, expiresAt } = parseTimeline(b.timeline);
  const url = absolutize(
    b.sellerInfo?.landingUrl ||
      b.originalData?.sellerInfo?.landingUrl ||
      b.actionUrl,
  );

  return {
    retailer: "miravia",
    title,
    code,
    description: [b.valueDesc, b.subTitle, `Tienda: ${store}`]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 280),
    url,
    startsAt,
    expiresAt,
    source: "scrape",
    externalId: `miravia:catalogue:${id}`,
    terms: termsFromBenefit(b),
  };
}

class CdpSession {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          id?: number;
          result?: unknown;
          error?: { message?: string };
        };
        if (msg.id == null) return;
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || "CDP error"));
        else p.resolve(msg.result);
      } catch {
        /* ignore */
      }
    });
  }

  static async connect(wsUrl: string): Promise<CdpSession> {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error("CDP WS error")), {
        once: true,
      });
    });
    return new CdpSession(ws);
  }

  send<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

async function waitForDevtools(port: number): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Chrome CDP no arrancó a tiempo");
}

async function openCataloguePage(
  port: number,
): Promise<{ wsUrl: string; cleanupTargetId?: string }> {
  // Prefer creating a fresh tab with the catalogue URL.
  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/json/new?${encodeURIComponent(MIRAVIA_COUPON_CATALOGUE_URL)}`,
      { method: "PUT" },
    );
    if (res.ok) {
      const target = (await res.json()) as {
        webSocketDebuggerUrl?: string;
        id?: string;
      };
      if (target.webSocketDebuggerUrl) {
        return {
          wsUrl: target.webSocketDebuggerUrl,
          cleanupTargetId: target.id,
        };
      }
    }
  } catch {
    /* fall through */
  }

  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const list = (await listRes.json()) as Array<{
    type: string;
    webSocketDebuggerUrl?: string;
  }>;
  const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
  if (!page?.webSocketDebuggerUrl) {
    throw new Error("No hay target page CDP");
  }
  return { wsUrl: page.webSocketDebuggerUrl };
}

async function fetchCatalogueBenefitsViaChrome(): Promise<BenefitVO[]> {
  const bin = chromePath();
  if (!bin) {
    throw new Error(
      "Chrome no encontrado. Define CHROME_PATH o instala Google Chrome para scrapear el catálogo Miravia.",
    );
  }

  const port = 9300 + Math.floor(Math.random() * 200);
  const userDataDir = join(tmpdir(), `miravia-coupons-${randomUUID()}`);
  const proc: ChildProcess = spawn(
    bin,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  try {
    await waitForDevtools(port);
    const { wsUrl } = await openCataloguePage(port);
    const cdp = await CdpSession.connect(wsUrl);

    try {
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");
      await cdp.send("Network.enable");

      await cdp.send("Page.navigate", { url: MIRAVIA_COUPON_CATALOGUE_URL });
      // Esperar hidratación (loadEventFired es evento, no método).
      await new Promise((r) => setTimeout(r, 5_000));

      for (let i = 0; i < 50; i += 1) {
        const ready = await cdp.send<{
          result?: {
            value?: { hasMtop?: boolean; items?: number; agree?: boolean };
          };
        }>("Runtime.evaluate", {
          expression: `({
            hasMtop: !!(window.lib && window.lib.mtop),
            items: document.querySelectorAll('[class*="coupon_item"]').length,
            agree: !!document.querySelector('.agreeButton')
          })`,
          returnByValue: true,
        });
        const v = ready.result?.value;
        if (v?.agree) {
          await cdp.send("Runtime.evaluate", {
            expression: "document.querySelector('.agreeButton')?.click()",
          });
        }
        if (v?.hasMtop || (v?.items ?? 0) > 0) break;
        await new Promise((r) => setTimeout(r, 400));
      }

      const fetchExpr = `
(async () => {
  const tagUnionId = ${TAG_UNION_ID};
  const pageSize = ${PAGE_SIZE};
  const maxPages = ${MAX_PAGES};
  const html = document.documentElement.innerHTML;
  const poolMatch = html.match(/"voucherPoolId"\\s*:\\s*"?(\\d+)"?/);
  const voucherPoolId = poolMatch ? Number(poolMatch[1]) : ${DEFAULT_POOL_ID};
  const all = [];
  const seen = new Set();

  async function requestPage(pageIndex) {
    const requestDTO = {
      tagUnionId,
      source: "COUPON_CHANNEL",
      bizParam: {
        voucherPoolId,
        pageIndex,
        pageSize,
        itemSize: 1,
      },
      jumpBenefitInfos: [],
      extInfo: { needSellerVoucherAlgo: true, needRemoveNoChance: false },
      moduleType: "COUPON_CHANNEL_SV_MODULE",
    };
    const data = {
      request: JSON.stringify({
        requestDTOList: [requestDTO],
        platform: "msite",
      }),
    };
    return await new Promise((resolve, reject) => {
      lib.mtop.request(
        {
          api: "mtop.miravia.ug.stars.vulcan.benefit.module",
          v: "1.0",
          needLogin: false,
          type: "GET",
          data,
          appKey: "${APP_KEY}",
          dataType: "json",
        },
        (res) => resolve(res),
        (err) => reject(err),
      );
    });
  }

  if (window.lib && lib.mtop && typeof lib.mtop.request === "function") {
    for (let i = 0; i < maxPages; i++) {
      const res = await requestPage(i);
      const block = res && res.data && res.data[String(tagUnionId)];
      const list = block && block.data && block.data.benefitVOList;
      if (!Array.isArray(list) || list.length === 0) break;
      for (const b of list) {
        const id = String(b.benefitId ?? "");
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        all.push(b);
      }
      if (!block.data.hasNextPage) break;
    }
    return all;
  }

  const items = [...document.querySelectorAll('[class*="coupon_item"]')];
  return items.map((el, idx) => {
    const t = (el.innerText || "").replace(/\\s+/g, " ").trim();
    const discount = (t.match(/(\\d+[.,]?\\d*\\s*%\\s*DTO\\.?|\\d+[.,]?\\d*\\s*€\\s*DTO\\.?)/i) || [])[1] || "";
    const minOrder = (t.match(/Pedido m[ií]n\\.?\\s*:?\\s*([\\d.,]+\\s*€)/i) || [])[1] || "";
    const store = (t.match(/seleccionados de\\s*([^!]+?)(?:\\s*¡|\\s*Termina|$)/i) || [])[1]?.trim() || "Miravia";
    const kind = (t.match(/Cupón de[^P]{0,40}/i) || [])[0]?.trim() || "Cupón de tienda";
    return {
      benefitId: "dom-" + idx + "-" + store,
      title: kind,
      value: discount,
      discountInfo: { value: discount.replace(/\\s*DTO\\.?/i, "").trim() },
      valueDesc: minOrder ? ("Pedido mín. " + minOrder) : "",
      sellerInfo: { storeName: store, landingUrl: "https://www.miravia.es/" },
      actionUrl: ${JSON.stringify(MIRAVIA_COUPON_CATALOGUE_URL)},
    };
  });
})()
`;

      const evaluated = await cdp.send<{
        result?: { value?: BenefitVO[] };
        exceptionDetails?: { text?: string };
      }>("Runtime.evaluate", {
        expression: fetchExpr,
        awaitPromise: true,
        returnByValue: true,
      });

      if (evaluated.exceptionDetails) {
        throw new Error(
          evaluated.exceptionDetails.text || "Miravia evaluate failed",
        );
      }
      return Array.isArray(evaluated.result?.value)
        ? evaluated.result!.value!
        : [];
    } finally {
      cdp.close();
    }
  } finally {
    try {
      proc.kill("SIGKILL");
    } catch {
      /* ignore */
    }
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/** Extrae cupones del Centro de cupones Miravia. */
export async function discoverMiraviaCatalogueCoupons(): Promise<
  DiscoveredCoupon[]
> {
  try {
    const benefits = await fetchCatalogueBenefitsViaChrome();
    const coupons = benefits
      .map(benefitToCoupon)
      .filter((c): c is DiscoveredCoupon => Boolean(c));
    console.log(
      `[coupons] Miravia catálogo → ${coupons.length} (${MIRAVIA_COUPON_CATALOGUE_URL})`,
    );
    return coupons;
  } catch (error) {
    console.warn(
      "[coupons] Miravia catálogo:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
