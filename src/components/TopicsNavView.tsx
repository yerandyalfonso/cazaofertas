import Link from "next/link";
import type { BlogTopic } from "@/services/blog";

/** Fila de temas del blog; `active` es el slug del tema («» = Todo, null = ninguno). */
export function TopicsNavView({
  topics,
  active,
}: {
  topics: BlogTopic[];
  active: string | null;
}) {
  const itemClass = (on: boolean) =>
    `shrink-0 border-b-2 py-3 transition-colors ${
      on
        ? "border-ink font-semibold text-ink"
        : "border-transparent text-stone-600 hover:text-ink"
    }`;

  return (
    <nav aria-label="Temas del blog" className="border-b border-stone-300/70">
      <div className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-5 text-sm [scrollbar-width:none] md:gap-7 md:px-8 [&::-webkit-scrollbar]:hidden">
        <Link href="/blog" className={itemClass(active === "")}>
          Todo
        </Link>
        {topics.map((topic) => (
          <Link
            key={topic.slug}
            href={`/blog?tema=${topic.slug}`}
            className={itemClass(active === topic.slug)}
          >
            {topic.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
