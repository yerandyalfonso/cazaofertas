"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  FileText,
  FolderTree,
  GalleryHorizontal,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  Settings2,
  Share2,
  Tag,
  Ticket,
  X,
  type LucideIcon,
} from "lucide-react";
import { AdminToastProvider } from "@/components/admin/AdminToast";

const NAV_GROUPS: Array<{
  title: string;
  items: Array<{ href: string; label: string; icon: LucideIcon }>;
}> = [
  {
    title: "Resumen",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/estadisticas", label: "Estadísticas", icon: BarChart3 },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/admin/products", label: "Productos", icon: Package },
      { href: "/admin/coupons", label: "Cupones", icon: Ticket },
      { href: "/admin/categories", label: "Categorías", icon: FolderTree },
      { href: "/admin/keywords", label: "Keywords", icon: Tag },
    ],
  },
  {
    title: "Contenido",
    items: [
      { href: "/admin/articles", label: "Artículos", icon: FileText },
      { href: "/admin/comments", label: "Comentarios", icon: MessageSquare },
      { href: "/admin/social", label: "Redes / Tarjetas", icon: Share2 },
      { href: "/admin/carousels", label: "Carruseles", icon: GalleryHorizontal },
    ],
  },
  {
    title: "Sistema",
    items: [{ href: "/admin/cron", label: "Operaciones", icon: Settings2 }],
  },
];

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

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/admin/social") {
      return pathname.startsWith("/admin/social") || pathname.startsWith("/admin/videos");
    }
    if (href === "/admin/cron") {
      return pathname.startsWith("/admin/cron") || pathname.startsWith("/admin/settings");
    }
    return pathname.startsWith(href);
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3" aria-label="Admin">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`admin-nav-link flex items-center gap-2.5 ${
                    active ? "admin-nav-link--active" : "text-[var(--text-muted)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
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
