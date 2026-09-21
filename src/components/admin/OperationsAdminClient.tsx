"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CronAdminClient } from "@/components/admin/CronAdminClient";
import { SettingsAdminClient } from "@/components/admin/SettingsAdminClient";

const TABS = [
  {
    id: "monitor",
    label: "Resumen",
    blurb: "Estado, cola Telegram y métricas del catálogo",
  },
  {
    id: "run",
    label: "Tareas",
    blurb: "Ejecutar crons y lotes a mano",
  },
  {
    id: "config",
    label: "Ajustes",
    blurb: "Umbrales, feeds y tag de afiliado",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return value === "monitor" || value === "config" || value === "run";
}

export function OperationsAdminClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab");
  const tab: TabId = isTabId(rawTab) ? rawTab : "monitor";
  const activeMeta = TABS.find((item) => item.id === tab) ?? TABS[0];

  function setTab(next: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "monitor") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(`/admin/cron${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <div>
      <header className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
          Operaciones
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
          {activeMeta.label}
        </h1>
        <p className="mt-2 text-sm text-stone-600">{activeMeta.blurb}</p>
      </header>

      <nav
        className="mt-8 grid gap-2 sm:grid-cols-3"
        aria-label="Secciones de operaciones"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg border px-4 py-3 text-left transition ${
                active
                  ? "border-teal-800 bg-teal-50/80 shadow-sm"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <span
                className={`block text-sm font-semibold ${
                  active ? "text-teal-950" : "text-ink"
                }`}
              >
                {item.label}
              </span>
              <span className="mt-0.5 block text-xs text-stone-500">
                {item.blurb}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-8">
        {tab === "monitor" ? <CronAdminClient mode="monitor" embedded /> : null}
        {tab === "run" ? <CronAdminClient mode="run" embedded /> : null}
        {tab === "config" ? <SettingsAdminClient embedded /> : null}
      </div>

      {tab === "monitor" ? (
        <p className="mt-10 text-sm text-stone-500">
          ¿Lanzar un cron?{" "}
          <Link
            href="/admin/cron?tab=run"
            className="font-medium text-teal-800 underline"
          >
            Ir a Tareas
          </Link>
          {" · "}
          <Link
            href="/admin/cron?tab=config"
            className="font-medium text-teal-800 underline"
          >
            Ajustes
          </Link>
        </p>
      ) : null}
      {tab === "run" ? (
        <p className="mt-10 text-sm text-stone-500">
          Umbrales y feeds:{" "}
          <Link
            href="/admin/cron?tab=config"
            className="font-medium text-teal-800 underline"
          >
            Ajustes
          </Link>
        </p>
      ) : null}
    </div>
  );
}
