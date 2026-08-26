"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

export interface ToastInput {
  kind?: ToastKind;
  message: string;
  durationMs?: number;
}

interface ToastItem extends Required<Omit<ToastInput, "durationMs">> {
  id: string;
  durationMs: number;
}

interface AdminToastContextValue {
  pushToast: (input: ToastInput | string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const AdminToastContext = createContext<AdminToastContextValue | null>(null);

export function useAdminToast(): AdminToastContextValue {
  const ctx = useContext(AdminToastContext);
  if (!ctx) {
    throw new Error("useAdminToast debe usarse dentro de AdminToastProvider.");
  }
  return ctx;
}

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (input: ToastInput | string) => {
      const payload: ToastInput =
        typeof input === "string" ? { message: input } : input;
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = {
        id,
        kind: payload.kind ?? "info",
        message: payload.message,
        durationMs: payload.durationMs ?? 4200,
      };
      setToasts((current) => [...current.slice(-4), item]);
      window.setTimeout(() => dismiss(id), item.durationMs);
    },
    [dismiss],
  );

  const value = useMemo<AdminToastContextValue>(
    () => ({
      pushToast,
      success: (message) => pushToast({ kind: "success", message }),
      error: (message) => pushToast({ kind: "error", message }),
      info: (message) => pushToast({ kind: "info", message }),
    }),
    [pushToast],
  );

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const styles =
            toast.kind === "success"
              ? "border-teal-800/30 bg-teal-50 text-teal-950"
              : toast.kind === "error"
                ? "border-rose-300 bg-rose-50 text-rose-950"
                : "border-stone-300 bg-white text-ink";
          const Icon =
            toast.kind === "success"
              ? CheckCircle2
              : toast.kind === "error"
                ? XCircle
                : Info;
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 border px-3 py-3 shadow-md ${styles}`}
              role="status"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1 text-sm leading-snug">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-sm p-0.5 opacity-60 hover:opacity-100"
                aria-label="Cerrar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </AdminToastContext.Provider>
  );
}
