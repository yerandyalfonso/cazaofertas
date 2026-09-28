"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { TopicsNavView } from "@/components/TopicsNavView";
import type { BlogTopic } from "@/services/blog";

/** Marca el tema activo según la URL (/blog?tema=…). */
export function TopicsNavClient({ topics }: { topics: BlogTopic[] }) {
  const pathname = usePathname();
  const tema = useSearchParams().get("tema") ?? "";
  return (
    <TopicsNavView topics={topics} active={pathname === "/blog" ? tema : null} />
  );
}
