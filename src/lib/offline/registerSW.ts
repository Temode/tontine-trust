/** Seul point d'enregistrement du service worker (hors ligne, site publié uniquement). */
async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()),
  );
}

export function registerOfflineSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const h = window.location.hostname;
  let inIframe = true;
  try { inIframe = window.self !== window.top; } catch { /* cross-origin */ }
  const refused =
    !import.meta.env.PROD ||
    inIframe ||
    h.startsWith("id-preview--") || h.startsWith("preview--") ||
    h === "lovableproject.com" || h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev") ||
    new URLSearchParams(window.location.search).get("sw") === "off";
  if (refused) {
    unregisterAppSW().catch(() => {});
    return;
  }
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
