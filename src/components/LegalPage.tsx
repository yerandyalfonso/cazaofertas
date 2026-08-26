import type { ReactNode } from "react";
import Link from "next/link";

export function LegalPage({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
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
      <div className="prose-legal mt-10 space-y-6 text-sm leading-relaxed text-stone-700">
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
