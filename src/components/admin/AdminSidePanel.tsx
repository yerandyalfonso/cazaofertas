"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

const SIZE_CLASS = {
  md: "admin-side-panel__sheet--md",
  lg: "admin-side-panel__sheet--lg",
  xl: "admin-side-panel__sheet--xl",
} as const;

export function AdminSidePanel({
  open,
  onClose,
  title,
  eyebrow,
  headerActions,
  footer,
  children,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  headerActions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  size?: keyof typeof SIZE_CLASS;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="admin-side-panel" role="dialog" aria-modal="true">
      <button
        type="button"
        className="admin-side-panel__backdrop"
        aria-label="Cerrar panel"
        onClick={onClose}
      />
      <aside className={`admin-side-panel__sheet ${SIZE_CLASS[size]}`}>
        <header className="admin-side-panel__header">
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="mt-1 font-display text-xl leading-tight text-[var(--text)] sm:text-2xl">
              {title}
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="admin-icon-btn"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="admin-side-panel__body">{children}</div>
        {footer ? (
          <footer className="admin-side-panel__footer">{footer}</footer>
        ) : null}
      </aside>
    </div>
  );
}
