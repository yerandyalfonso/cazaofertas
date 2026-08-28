"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AdminToastProvider } from "@/components/admin/AdminToast";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Productos" },
  { href: "/admin/categories", label: "Categorías" },
  { href: "/admin/articles", label: "Artículos" },
  { href: "/admin/cron", label: "Monitorización / Cron" },
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
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`rounded-sm px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-ink text-paper"
                : "text-stone-600 hover:bg-stone-100 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="space-y-2 border-t border-stone-200 p-4">
      <Link
        href="/"
        className="block text-xs text-stone-500 underline-offset-2 hover:text-ink hover:underline"
      >
        Ver web pública
      </Link>
      <button
        type="button"
        onClick={() => void onLogout()}
        disabled={loggingOut}
        className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-600 hover:text-ink disabled:opacity-50"
      >
        {loggingOut ? "Saliendo…" : "Cerrar sesión"}
      </button>
    </div>
  );

  return (
    <AdminToastProvider>
      <div className="flex min-h-screen bg-stone-100 text-ink">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-stone-300 bg-white md:flex">
          <div className="border-b border-stone-200 px-5 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-800">
              Admin
            </p>
            <p className="mt-1 font-display text-xl tracking-tight">CazaOferta</p>
          </div>
          {nav}
          {footer}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between border-b border-stone-300 bg-white px-4 py-3 md:hidden">
            <p className="font-display text-lg tracking-tight">Admin</p>
            <button
              type="button"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center border border-stone-300"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
          {open ? (
            <div className="border-b border-stone-300 bg-white md:hidden">
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
