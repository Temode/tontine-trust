import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { deepLinkToPath } from "@/lib/deepLink";

/** Monté une fois à la racine : ouvre /appel/<id> depuis l'écran d'appel natif, app ouverte ou fermée. */
export function NativeDeepLinkBridge() {
  const navigate = useNavigate();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    const go = (url?: string | null) => {
      const path = deepLinkToPath(url);
      if (!path || handled.current === url) return;
      handled.current = url ?? null;
      navigate(path, { replace: true });
    };
    (async () => {
      const { App } = await import("@capacitor/app");
      const launch = await App.getLaunchUrl().catch(() => undefined);
      go(launch?.url);
      const h = await App.addListener("appUrlOpen", ({ url }) => go(url));
      remove = () => h.remove();
    })();
    return () => remove?.();
  }, [navigate]);

  return null;
}
