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
    <div className="admin-shell admin-login">
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="admin-login-card"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          CazaOferta
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
          Acceso admin
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Introduce la contraseña de administrador (
          <code className="rounded bg-[var(--surface-muted)] px-1">
            ADMIN_PASSWORD
          </code>{" "}
          o{" "}
          <code className="rounded bg-[var(--surface-muted)] px-1">
            CRON_SECRET
          </code>
          ).
        </p>
        <label className="mt-6 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="admin-input mt-2"
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
          className="admin-btn admin-btn-primary mt-6 w-full"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
