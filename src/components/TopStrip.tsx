import { TopStripClient } from "@/components/TopStripClient";
import { getPublishedArticlesCached } from "@/services/blog";

/** Franja superior: fecha de hoy y el último artículo publicado. */
export async function TopStrip() {
  let latest;
  try {
    const posts = await getPublishedArticlesCached();
    latest = [...posts].sort((a, b) =>
      b.publishedAt.localeCompare(a.publishedAt),
    )[0];
  } catch {
    return null;
  }
  if (!latest) return null;

  const dateLabel = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  }).format(new Date());

  return (
    <TopStripClient
      dateLabel={dateLabel}
      href={`/blog/${latest.slug}`}
      title={latest.title}
      itemKey={latest.slug}
    />
  );
}
