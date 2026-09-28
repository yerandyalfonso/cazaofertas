"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "top-strip-dismissed";

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Franja «Nuevo: …» que se puede cerrar; se vuelve a mostrar con el siguiente artículo. */
export function TopStripClient({
  dateLabel,
  href,
  title,
  itemKey,
}: {
  dateLabel: string;
  href: string;
  title: string;
  itemKey: string;
}) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => readDismissed() === itemKey,
    () => false,
  );

  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, itemKey);
    } catch {
      // Sin almacenamiento: se oculta solo en esta visita.
    }
    listeners.forEach((listener) => listener());
  }

  return (
    <div className="bg-ink text-stone-200">
      <div className="mx-auto flex h-8 max-w-6xl items-center gap-3 px-5 text-xs md:px-8">
        <span className="hidden shrink-0 text-stone-400 first-letter:uppercase sm:inline-block">
          {dateLabel}
        </span>
        <span className="shrink-0 font-semibold uppercase tracking-[0.14em] text-amber-200">
          Nuevo
        </span>
        <Link
          href={href}
          className="min-w-0 flex-1 truncate underline-offset-4 hover:text-white hover:underline"
        >
          {title} →
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar aviso"
          className="-mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center text-base text-stone-400 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}
