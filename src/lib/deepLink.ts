/** Traduit com.tontinedigitale.app://appel/<id>[?action=...] en chemin interne, ou null. */
export function deepLinkToPath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const path = `/${parsed.host}${parsed.pathname}`.replace(/\/+$/, "") + parsed.search;
    return /^\/appel\/[^/?]+/.test(path) ? path : null;
  } catch {
    return null;
  }
}
