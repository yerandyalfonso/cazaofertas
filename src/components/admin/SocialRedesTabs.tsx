"use client";

import Link from "next/link";

export function SocialRedesTabs({
  active,
}: {
  active: "cards" | "videos";
}) {
  const tabClass = (id: "cards" | "videos") =>
    `inline-flex h-10 items-center border-b-2 px-4 text-xs font-semibold uppercase tracking-[0.12em] transition ${
      active === id
        ? "border-ink text-ink"
        : "border-transparent text-stone-500 hover:text-ink"
    }`;

  return (
    <div className="mb-8 border-b border-stone-200">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
        Redes
      </p>
      <h1 className="mt-2 font-display text-3xl text-ink">Tarjetas y videos</h1>
      <nav className="mt-5 flex gap-1">
        <Link href="/admin/social" className={tabClass("cards")}>
          Tarjetas
        </Link>
        <Link href="/admin/videos" className={tabClass("videos")}>
          Videos
        </Link>
      </nav>
    </div>
  );
}
