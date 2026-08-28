"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Si la navegación cliente trae datos incompletos (p. ej. prefetch fallido),
 * fuerza un refresh del servidor una sola vez.
 */
export function BlogArticleAutoRefresh({
  enabled,
}: {
  enabled: boolean;
}) {
  const router = useRouter();
  const refreshed = useRef(false);

  useEffect(() => {
    if (!enabled || refreshed.current) return;
    refreshed.current = true;
    router.refresh();
  }, [enabled, router]);

  return null;
}
