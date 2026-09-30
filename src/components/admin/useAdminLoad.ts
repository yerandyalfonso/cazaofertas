"use client";

import { useEffect } from "react";

/**
 * Carga de datos del admin: ejecuta `load` al montar y cada vez que cambia
 * (sus dependencias son los filtros). Se lanza en el siguiente ciclo, no
 * dentro del efecto, para no encadenar renders; si `load` cambia antes de
 * arrancar (p. ej. al teclear en el buscador), solo corre la última.
 * `enabled = false` la deja en espera (editor aún sin preparar, etc.).
 */
export function useAdminLoad(load: () => unknown, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load, enabled]);
}
