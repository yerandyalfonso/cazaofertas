"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Scissors,
} from "lucide-react";
import type { CouponOffer } from "@/lib/coupons";
import { formatCouponExpiry } from "@/lib/coupons";
import {
  MARKETPLACE_RETAILERS,
  RETAILER_COLORS,
  retailerLabel,
} from "@/lib/retailers";

interface CouponsPageContentProps {
  coupons: CouponOffer[];
}

function CouponCard({ coupon }: { coupon: CouponOffer }) {
  const [copied, setCopied] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const color = RETAILER_COLORS[coupon.retailer] ?? "#4f7f6a";
  const expiry = formatCouponExpiry(coupon.expiresAt);
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
    <article
      className={`coupon-card ${coupon.highlight ? "coupon-card--highlight" : ""}`}
    >
      <div className="coupon-card-notch coupon-card-notch--left" aria-hidden />
      <div className="coupon-card-notch coupon-card-notch--right" aria-hidden />

      <div className="coupon-card-body">
        <div className="coupon-card-main">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="badge text-white"
              style={{ backgroundColor: color }}
            >
              {retailerLabel(coupon.retailer)}
            </span>
            {coupon.highlight && (
              <span className="badge badge-great">Destacado</span>
            )}
            {coupon.source === "affiliate" && (
              <span className="badge bg-[var(--primary-soft)] text-[var(--primary)]">
                Afiliado
              </span>
            )}
            {coupon.source === "scrape" && (
              <span className="badge bg-[var(--surface-muted)] text-[var(--text-muted)]">
                Detectado
              </span>
            )}
            {expiry && (
              <span className="text-xs text-[var(--text-muted)]">
                Hasta {expiry}
              </span>
            )}
          </div>

          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">
            {coupon.title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
            {coupon.description}
          </p>

          {hasRedeemCode ? (
            <button
              type="button"
              onClick={copyCode}
              className="coupon-code-btn mt-4"
            >
              <Scissors className="h-4 w-4 shrink-0 text-[var(--primary)]" />
              <span className="font-mono text-sm font-bold tracking-wide">
                {coupon.code}
              </span>
              <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[var(--primary)]" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </>
                )}
              </span>
            </button>
          ) : null}

          {terms ? (
            <div className={hasRedeemCode ? "mt-3" : "mt-4"}>
              <button
                type="button"
                onClick={() => setTermsOpen((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"
                aria-expanded={termsOpen}
              >
                Condiciones
                <ChevronDown
                  className={`h-3.5 w-3.5 transition ${termsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {termsOpen ? (
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-muted)]">
                  {terms}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="coupon-card-action">
          <a
            href={coupon.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary coupon-store-btn"
          >
            <span className="font-semibold">
              Ir a {retailerLabel(coupon.retailer)}
            </span>
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          </a>
        </div>
      </div>
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
      <div className="card px-6 py-12 text-center text-[var(--text-muted)]">
        <p>No hay cupones activos en este momento.</p>
        <p className="mt-2 text-sm">
          Se actualizan automáticamente dos veces al día desde las tiendas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="flex gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-muted)]"
        role="note"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
        <p>
          Cupones manuales y detectados. Abre <strong>Condiciones</strong> en cada
          ficha para ver vigencia y exclusiones.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRetailer(null)}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            retailer === null
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]"
          }`}
        >
          Todas ({coupons.length})
        </button>
        {retailers.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setRetailer(id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              retailer === id
                ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]"
            }`}
          >
            {retailerLabel(id)} ({grouped.get(id)?.length ?? 0})
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {visible.map((coupon) => (
          <CouponCard key={coupon.id} coupon={coupon} />
        ))}
      </div>
    </div>
  );
}
