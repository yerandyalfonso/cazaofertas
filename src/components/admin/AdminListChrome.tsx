"use client";

import type { ReactNode, Ref } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";
import { retailerColor, retailerLabel } from "@/lib/retailers";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function AdminSearchField({
  value,
  onChange,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <label className="admin-search-field">
      <span className="sr-only">{placeholder}</span>
      <Search className="admin-search-icon" aria-hidden />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="admin-input admin-input--search"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="admin-search-clear"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </label>
  );
}

export function AdminSearchToolbar({
  value,
  onChange,
  placeholder,
  children,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  children?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="admin-toolbar">
      <AdminSearchField
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputRef={inputRef}
      />
      {children}
    </div>
  );
}

export function AdminSortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-[0.12em] transition hover:text-[var(--text)] ${
        active ? "text-[var(--text)]" : "text-[var(--text-muted)]"
      }`}
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ArrowUp className="h-3 w-3" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />
      )}
    </button>
  );
}

export function AdminRetailerBadge({ retailer }: { retailer: string }) {
  return (
    <span
      className="admin-retailer-badge"
      style={{ backgroundColor: retailerColor(retailer) }}
    >
      {retailerLabel(retailer)}
    </span>
  );
}
