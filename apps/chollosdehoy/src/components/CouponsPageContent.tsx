"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Ticket } from "lucide-react";
import type { CouponOffer } from "@/lib/coupons";
import { couponDetails, couponHighlight, formatCouponExpiry } from "@/lib/coupons";
import {
  MARKETPLACE_RETAILERS,
  retailerColor,
  retailerLabel,
} from "@/lib/retailers";

interface CouponsPageContentProps {
  coupons: CouponOffer[];
}

function CouponCard({ coupon }: { coupon: CouponOffer }) {
  const [copied, setCopied] = useState(false);
  const expiry = formatCouponExpiry(coupon.expiresAt);
  const highlight = couponHighlight(coupon.description);
  const details = couponDetails(coupon.description);
  const hasRedeemCode =
    Boolean(coupon.code) &&
    !/^(PROMO-|CUPONES-|CLUB-|MV-|AWIN-|CLIP-)/i.test(coupon.code);
  const terms = coupon.terms?.trim();

  async function copyCode() {
    if (!hasRedeemCode) return;
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <article className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex shrink-0 items-center gap-3 sm:w-28 sm:flex-col sm:items-start sm:gap-0">
        <Ticket className="h-5 w-5 text-vivid sm:hidden" aria-hidden />
        <p className="price text-2xl font-semibold leading-none text-ink">
          {highlight?.value ?? "Cupón"}
        </p>
        {highlight && <p className="text-xs text-muted sm:mt-1">{highlight.label}</p>}
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
          <span translate="no" className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: retailerColor(coupon.retailer) }}
            />
            {retailerLabel(coupon.retailer)}
          </span>
          {expiry && <span>· Hasta {expiry}</span>}
          {coupon.highlight && <span className="font-medium text-primary">· Destacado</span>}
        </p>
        <h2 className="mt-1 line-clamp-2 text-[0.95rem] font-semibold leading-snug text-ink">
          {coupon.title}
        </h2>
        {details.length > 0 && (
          <p className="mt-1 text-sm text-muted">{details.join(" · ")}</p>
        )}

        {hasRedeemCode && (
          <button
            type="button"
            onClick={copyCode}
            aria-live="polite"
            className="coupon-code-btn mt-3"
          >
            <span className="font-mono text-sm font-bold tracking-wide">{coupon.code}</span>
            <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-muted">
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-vivid" aria-hidden />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  Copiar código
                </>
              )}
            </span>
          </button>
        )}

        {terms && (
          <details className="group mt-2">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary hover:underline">
              Condiciones
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted">{terms}</p>
          </details>
        )}
      </div>

      <a
        href={coupon.url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="btn btn-primary shrink-0 sm:self-center"
      >
        Ver en {retailerLabel(coupon.retailer)}
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
      </a>
    </article>
  );
}

export function CouponsPageContent({ coupons }: CouponsPageContentProps) {
  const [retailer, setRetailer] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, CouponOffer[]>();
    for (const c of coupons) {
      const list = map.get(c.retailer) ?? [];
      list.push(c);
      map.set(c.retailer, list);
    }
    return map;
  }, [coupons]);

  const retailers = useMemo(() => {
    const set = new Set(coupons.map((c) => c.retailer));
    const preferred = MARKETPLACE_RETAILERS.filter((r) => set.has(r));
    const rest = [...set]
      .filter((r) => !MARKETPLACE_RETAILERS.includes(r))
      .sort((a, b) => retailerLabel(a).localeCompare(retailerLabel(b), "es"));
    return [...preferred, ...rest];
  }, [coupons]);

  const visible = retailer ? (grouped.get(retailer) ?? []) : coupons;

  if (coupons.length === 0) {
    return (
      <div className="card px-6 py-12 text-center text-muted">
        <p>No hay cupones activos en este momento.</p>
        <p className="mt-2 text-sm">
          Se actualizan automáticamente dos veces al día desde las tiendas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {retailers.length > 1 && (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRetailer(null)}
          className={`tap-target rounded-full border px-4 py-2 text-sm font-semibold transition ${
            retailer === null
              ? "border-vivid bg-vivid text-white"
              : "border-line bg-surface text-muted"
          }`}
        >
          Todas ({coupons.length})
        </button>
        {retailers.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setRetailer(id)}
            className={`tap-target rounded-full border px-4 py-2 text-sm font-semibold transition ${
              retailer === id
                ? "border-primary bg-primary-soft text-primary"
                : "border-line bg-surface text-muted"
            }`}
          >
            {retailerLabel(id)} ({grouped.get(id)?.length ?? 0})
          </button>
        ))}
      </div>
      )}

      <div className="grid gap-3">
        {visible.map((coupon) => (
          <CouponCard key={coupon.id} coupon={coupon} />
        ))}
      </div>
    </div>
  );
}
