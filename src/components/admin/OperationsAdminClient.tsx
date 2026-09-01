"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CronAdminClient } from "@/components/admin/CronAdminClient";
import { SettingsAdminClient } from "@/components/admin/SettingsAdminClient";

const TABS = [
  { id: "monitor", label: "Resumen" },
  { id: "config", label: "Configuración" },
  { id: "run", label: "Ejecutar" },
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

  function setTab(next: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "monitor") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(`/admin/cron${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <div>
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
          Operaciones
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
          Monitorización y configuración
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Estado de crons, ajustes de feeds y Telegram, y ejecución manual de
          tareas.
        </p>
      </header>

      <nav
        className="mt-8 flex flex-wrap gap-2 border-b border-stone-200"
        aria-label="Secciones de operaciones"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? "border-teal-800 text-teal-900"
                  : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-8">
        {tab === "monitor" ? <CronAdminClient mode="monitor" embedded /> : null}
        {tab === "config" ? <SettingsAdminClient embedded /> : null}
        {tab === "run" ? <CronAdminClient mode="run" embedded /> : null}
      </div>

      {tab !== "config" ? (
        <p className="mt-10 text-sm text-stone-500">
          Feeds, umbrales Telegram y límites:{" "}
          <Link
            href="/admin/cron?tab=config"
            className="font-medium text-teal-800 underline"
          >
            Configuración
          </Link>
        </p>
      ) : null}
    </div>
  );
}
