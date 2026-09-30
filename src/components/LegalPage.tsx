import type { ReactNode } from "react";
import Link from "next/link";
import { formatLegalDate, LEGAL_UPDATED_AT } from "@/lib/legal";

export function LegalPage({
  title,
  eyebrow,
  intro,
  children,
}: {
  title: string;
  eyebrow: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-stone-500">
        Última actualización: {formatLegalDate(LEGAL_UPDATED_AT)}
      </p>
      {intro ? (
        <div className="mt-8 border-l-2 border-teal-700/50 pl-4 text-base leading-relaxed text-stone-700">
          {intro}
        </div>
      ) : null}
      <div className="prose-legal mt-10 space-y-8 text-sm leading-relaxed text-stone-700">
        {children}
      </div>
      <p className="mt-12 text-sm text-stone-500">
        <Link href="/" className="underline-offset-2 hover:text-ink hover:underline">
          ← Volver al inicio
        </Link>
      </p>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** Datos del titular que estén rellenos (LSSI, art. 10). */
export function OwnerDetails({
  owner,
}: {
  owner: { name: string; taxId: string; address: string; email: string };
}) {
  const rows = [
    ["Titular", owner.name],
    ["NIF", owner.taxId],
    ["Domicilio", owner.address],
    ["Email", owner.email],
  ].filter(([, value]) => value);
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-1">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-semibold text-ink">{label}</dt>
          <dd>
            {label === "Email" ? (
              <a href={`mailto:${value}`} className="underline underline-offset-2">
                {value}
              </a>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
