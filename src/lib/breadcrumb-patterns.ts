/** Patrones de breadcrumb: uno por línea (fuente regex, sin /…/). */

export function normalizeBreadcrumbPatterns(patterns: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of patterns) {
    let value = raw.trim();
    if (!value) continue;
    // Si pegan /patron/i lo normalizamos a la fuente.
    const wrapped = value.match(/^\/(.+)\/[a-z]*$/i);
    if (wrapped) value = wrapped[1];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function parseBreadcrumbPatternList(
  raw: string | string[] | null | undefined,
): string[] {
  if (Array.isArray(raw)) return normalizeBreadcrumbPatterns(raw);
  if (!raw?.trim()) return [];
  return normalizeBreadcrumbPatterns(raw.split(/\n+/));
}

export function formatBreadcrumbPatternList(patterns: string[]): string {
  return normalizeBreadcrumbPatterns(patterns).join("\n");
}

export function compileBreadcrumbPatterns(sources: string[]): RegExp[] {
  const out: RegExp[] = [];
  for (const source of normalizeBreadcrumbPatterns(sources)) {
    try {
      out.push(new RegExp(source));
    } catch {
      console.warn("[category-keywords] regex inválida:", source);
    }
  }
  return out;
}
