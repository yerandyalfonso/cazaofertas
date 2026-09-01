"use client";

import type { ReactNode } from "react";

export function AdminSkeleton({
  className = "",
}: {
  className?: string;
}) {
  return <span className={`admin-skeleton ${className}`} aria-hidden />;
}

/** Filas de skeleton; por defecto suficientes para llenar ~viewport sin saltos. */
export function AdminTableSkeleton({
  rows = 14,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} className="border-t border-[var(--border)]">
          {Array.from({ length: cols }, (_, col) => (
            <td key={col} className="px-4 py-3.5">
              <AdminSkeleton
                className={
                  col === 0
                    ? "h-10 w-10 rounded-[var(--radius-sm)]"
                    : col === 1
                      ? "h-3.5 w-[72%]"
                      : "h-3.5 w-[52%]"
                }
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Skeleton alineado con la tabla de productos (columnas fijas). */
export function AdminProductsTableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} className="border-t border-stone-100">
          <td className="px-3 py-3">
            <AdminSkeleton className="mx-auto h-4 w-4 rounded-sm" />
          </td>
          <td className="px-4 py-3">
            <div className="flex items-start gap-3">
              <AdminSkeleton className="h-12 w-12 shrink-0 rounded-sm" />
              <div className="min-w-0 flex-1 space-y-2">
                <AdminSkeleton className="h-3.5 w-[88%]" />
                <AdminSkeleton className="h-3 w-[42%]" />
              </div>
            </div>
          </td>
          <td className="px-4 py-3">
            <AdminSkeleton className="h-5 w-16 rounded-full" />
            <AdminSkeleton className="mt-2 h-3 w-24" />
          </td>
          <td className="px-4 py-3">
            <AdminSkeleton className="h-3.5 w-14" />
          </td>
          <td className="px-4 py-3">
            <AdminSkeleton className="h-3.5 w-14" />
          </td>
          <td className="px-4 py-3">
            <AdminSkeleton className="h-3.5 w-10" />
            <AdminSkeleton className="mt-2 h-3 w-16" />
          </td>
          <td className="px-4 py-3">
            <AdminSkeleton className="h-3.5 w-20" />
          </td>
          <td className="px-4 py-3">
            <AdminSkeleton className="h-3.5 w-28" />
          </td>
          <td className="sticky right-0 bg-white px-3 py-3 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.1)]">
            <div className="admin-row-actions">
              <AdminSkeleton className="h-8 w-8 rounded-sm" />
              <AdminSkeleton className="h-8 w-8 rounded-sm" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export function AdminCardGridSkeleton({
  count = 6,
}: {
  count?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="admin-card p-4">
          <AdminSkeleton className="h-36 w-full rounded-[var(--radius-sm)]" />
          <AdminSkeleton className="mt-3 h-3.5 w-3/4" />
          <AdminSkeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function AdminListRowsSkeleton({
  rows = 6,
}: {
  rows?: number;
}) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <AdminSkeleton className="h-12 w-12 shrink-0 rounded-[var(--radius-sm)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <AdminSkeleton className="h-3.5 w-2/3" />
            <AdminSkeleton className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AdminPageLoadingSkeleton({
  variant = "table",
}: {
  variant?: "table" | "cards" | "rows";
}): ReactNode {
  if (variant === "cards") return <AdminCardGridSkeleton />;
  if (variant === "rows") {
    return (
      <div className="admin-card overflow-hidden">
        <AdminListRowsSkeleton rows={12} />
      </div>
    );
  }
  return (
    <div className="admin-table-wrap admin-table-wrap--fill mt-4">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {Array.from({ length: 6 }, (_, i) => (
              <th key={i} className="px-4 py-3">
                <AdminSkeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AdminTableSkeleton rows={14} cols={6} />
        </tbody>
      </table>
    </div>
  );
}
