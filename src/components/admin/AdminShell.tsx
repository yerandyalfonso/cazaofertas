"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Productos" },
  { href: "/admin/articles", label: "Artículos" },
  { href: "/admin/cron", label: "Monitorización / Cron" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-stone-100 text-ink">
      <aside className="flex w-60 shrink-0 flex-col border-r border-stone-300 bg-white">
        <div className="border-b border-stone-200 px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-800">
            Admin
          </p>
          <p className="mt-1 font-display text-xl tracking-tight">CazaOferta</p>
        </div>
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
        <div className="border-t border-stone-200 p-4">
          <Link
            href="/"
            className="block text-xs text-stone-500 underline-offset-2 hover:text-ink hover:underline"
          >
            Ver web pública
          </Link>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-10">
          {children}
        </div>
      </div>
    </div>
  );
}
