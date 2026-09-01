"use client";

import { Percent, ShoppingBag, Store } from "lucide-react";
import { retailerLabel } from "@/lib/retailers";
import type { MarketplaceStats } from "@/lib/types";

interface StatsBarProps {
  stats: MarketplaceStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="card flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Ofertas activas</p>
          <p className="text-lg font-bold">{stats.totalProducts}</p>
        </div>
      </div>

      <div className="card flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f0ff] text-[#2f6fed]">
          <Percent className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Descuento medio</p>
          <p className="text-lg font-bold">{stats.avgDiscount}%</p>
        </div>
      </div>

      <div className="card flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff4e5] text-[#9a5b00]">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Tienda con más ofertas</p>
          <p className="text-lg font-bold">
            {stats.topRetailer
              ? `${retailerLabel(stats.topRetailer.id)} (${stats.topRetailer.count})`
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
