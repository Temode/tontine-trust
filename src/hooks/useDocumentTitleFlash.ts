import { useEffect } from "react";

/**
 * Fait clignoter le <title> tant que `active` est vrai et que l'onglet
 * est caché. Restaure le titre initial à l'arrêt ou au focus.
 */
export function useDocumentTitleFlash(active: boolean, message: string) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const original = document.title;
    let toggle = false;
    let timer: number | null = null;

    const tick = () => {
      if (!document.hidden) {
        document.title = original;
      } else {
        document.title = toggle ? message : `📞 ${message}`;
        toggle = !toggle;
      }
      timer = window.setTimeout(tick, 900);
    };
    const onVisible = () => {
      if (!document.hidden) document.title = original;
    };
    document.addEventListener("visibilitychange", onVisible);
    tick();
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      document.title = original;
    };
  }, [active, message]);
}