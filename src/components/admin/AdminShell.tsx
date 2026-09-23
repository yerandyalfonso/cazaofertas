"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AdminToastProvider } from "@/components/admin/AdminToast";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/estadisticas", label: "Estadísticas" },
  { href: "/admin/products", label: "Productos" },
  { href: "/admin/coupons", label: "Cupones" },
  { href: "/admin/categories", label: "Categorías" },
  { href: "/admin/keywords", label: "Keywords" },
  { href: "/admin/articles", label: "Artículos" },
  { href: "/admin/comments", label: "Comentarios" },
  { href: "/admin/cron", label: "Operaciones" },
  { href: "/admin/social", label: "Redes / Tarjetas" },
  { href: "/admin/carousels", label: "Carruseles" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function onLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : item.href === "/admin/social"
              ? pathname.startsWith("/admin/social") ||
                pathname.startsWith("/admin/videos")
              : item.href === "/admin/cron"
                ? pathname.startsWith("/admin/cron") ||
                  pathname.startsWith("/admin/settings")
                : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`admin-nav-link ${
              active ? "admin-nav-link--active" : "text-[var(--text-muted)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="space-y-2 border-t border-[var(--border)] p-4">
      <Link
        href="/"
        className="block text-xs text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text)] hover:underline"
      >
        Ver web pública
      </Link>
      <button
        type="button"
        onClick={() => void onLogout()}
        disabled={loggingOut}
        className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
      >
        {loggingOut ? "Saliendo…" : "Cerrar sesión"}
      </button>
    </div>
  );

  return (
    <AdminToastProvider>
      <div className="admin-shell flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] md:flex">
          <div className="border-b border-[var(--border)] px-5 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
              Admin
            </p>
            <p className="mt-1 text-xl font-bold tracking-tight text-[var(--text)]">
              CazaOferta
            </p>
          </div>
          {nav}
          {footer}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:hidden">
            <p className="text-lg font-bold tracking-tight text-[var(--text)]">
              Admin
            </p>
            <button
              type="button"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              onClick={() => setOpen((v) => !v)}
              className="admin-icon-btn"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
          {open ? (
            <div className="border-b border-[var(--border)] bg-[var(--surface)] md:hidden">
              {nav}
              {footer}
            </div>
          ) : null}
          <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 md:px-10 md:py-10">
            {children}
          </div>
        </div>
      </div>
    </AdminToastProvider>
  );
}
