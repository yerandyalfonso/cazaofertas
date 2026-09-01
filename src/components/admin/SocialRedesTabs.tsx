"use client";

import Link from "next/link";

export function SocialRedesTabs({
  active,
}: {
  active: "cards" | "videos";
}) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        Redes
      </p>
      <h1 className="mt-2 font-display text-3xl text-[var(--text)]">
        Tarjetas y videos
      </h1>
      <nav className="admin-tabs mt-5" aria-label="Secciones de redes">
        <Link
          href="/admin/social"
          className={`admin-tab${active === "cards" ? " admin-tab--active" : ""}`}
        >
          Tarjetas
        </Link>
        <Link
          href="/admin/videos"
          className={`admin-tab${active === "videos" ? " admin-tab--active" : ""}`}
        >
          Videos
        </Link>
      </nav>
    </div>
  );
}
