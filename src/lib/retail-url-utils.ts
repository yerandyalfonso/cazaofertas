/** Título legible a partir del slug de la URL (antes del ID de producto). */
export function titleFromProductSlug(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const segment = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    const withoutId = segment
      .replace(/_P\d+C\d+$/i, "")
      .replace(/\/VC4A-\d+.*$/i, "")
      .trim();
    if (!withoutId || withoutId.length < 3) return null;
    return withoutId
      .split("-")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return null;
  }
}

export function isRetailBlockedHtml(html: string): boolean {
  return (
    /captcha-delivery\.com/i.test(html) ||
    /Please enable JS and disable any ad blocker/i.test(html) ||
    /Attention Required! \| Cloudflare/i.test(html) ||
    /Sorry, you have been blocked/i.test(html) ||
    html.length < 800
  );
}

export function isRetailBlockedError(message: string): boolean {
  return /403|datadome|anti-bot|bloqueó|cloudflare|blocked/i.test(message);
}
