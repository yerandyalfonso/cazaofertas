"use client";

import { Check, Copy, ExternalLink, Ticket } from "lucide-react";
import { useState } from "react";
import type { CouponOffer } from "@/lib/coupons";
import { RETAILER_COLORS, retailerLabel } from "@/lib/retailers";

interface CouponsSectionProps {
  coupons: CouponOffer[];
}

function hasRedeemCode(code: string): boolean {
  return Boolean(code) && !/^(PROMO-|CUPONES-|CLUB-|MV-|AWIN-|CLIP-)/i.test(code);
}

function CouponCard({ coupon }: { coupon: CouponOffer }) {
  const [copied, setCopied] = useState(false);
  const color = RETAILER_COLORS[coupon.retailer] ?? "#4f7f6a";
  const showCode = hasRedeemCode(coupon.code);

  async function copyCode() {
    if (!showCode) return;
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <article
      className={`card flex flex-col gap-3 p-4 ${
        coupon.highlight ? "border-[var(--primary)] bg-[var(--primary-soft)]/30" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="badge text-white"
          style={{ backgroundColor: color }}
        >
          {retailerLabel(coupon.retailer)}
        </span>
        {coupon.highlight && (
          <span className="badge badge-great">Destacado</span>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-[var(--text)]">{coupon.title}</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {coupon.description}
        </p>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {showCode ? (
          <button
            type="button"
            onClick={copyCode}
            className="btn btn-ghost flex-1 font-mono text-sm"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-[var(--primary)]" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {coupon.code}
              </>
            )}
          </button>
        ) : null}
        <a
          href={coupon.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary text-sm"
        >
          Ir a {retailerLabel(coupon.retailer)}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </article>
  );
}

export function CouponsSection({ coupons }: CouponsSectionProps) {
  if (coupons.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Ticket className="h-5 w-5 text-[var(--primary)]" />
        <h2 className="text-lg font-bold text-[var(--text)]">
          Cupones y códigos
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {coupons.map((coupon) => (
          <CouponCard key={coupon.id} coupon={coupon} />
        ))}
      </div>
    </section>
  );
}
