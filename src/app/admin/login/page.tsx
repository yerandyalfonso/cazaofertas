"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "No se pudo iniciar sesión.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-5">
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="w-full max-w-sm border border-stone-300 bg-white p-8 shadow-sm"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-800">
          CazaOferta
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-ink">
          Acceso admin
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Usa <code className="rounded bg-stone-100 px-1">ADMIN_PASSWORD</code>{" "}
          o, en local sin configurar, cualquier valor si el acceso está abierto.
        </p>
        <label className="mt-6 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm text-ink outline-none focus:border-ink"
            autoComplete="current-password"
            required
          />
        </label>
        {error ? (
          <p className="mt-3 text-sm text-rose-700">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex h-11 w-full items-center justify-center bg-ink text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900 disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
