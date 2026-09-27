"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageNumbers } from "@/lib/pagination";

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  loading,
}: PaginationBarProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = pageNumbers(page, totalPages);

  return (
    <nav
      className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Paginación del catálogo"
    >
      <p className="text-sm text-muted">
        Mostrando <span className="font-medium text-ink">{from}–{to}</span>{" "}
        de <span className="font-medium text-ink">{total}</span> ofertas
      </p>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          className="btn btn-ghost p-2 disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, index) =>
          p === "…" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-sm text-muted"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              disabled={loading}
              onClick={() => onPageChange(p)}
              className={`tap-target min-w-[2.25rem] rounded-control px-2 py-1.5 text-sm font-semibold transition ${
                p === page
                  ? "bg-primary text-white"
                  : "text-muted hover:bg-surface-muted"
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
          className="btn btn-ghost p-2 disabled:opacity-40"
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
