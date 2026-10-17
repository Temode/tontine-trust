import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/** Réglages natifs (barre d'état, splash, bouton retour) + enregistrement push. No-op sur le web. */
export function useNativeApp() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
        import("@capacitor/app"),
      ]);
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        if (Capacitor.getPlatform() === "android") await StatusBar.setBackgroundColor({ color: "#0B5559" });
      } catch { /* noop */ }
      SplashScreen.hide().catch(() => {});
      const h = await App.addListener("backButton", ({ canGoBack }) => {
        const p = window.location.pathname;
        if (p === "/dashboard" || p === "/" || !canGoBack) App.exitApp();
        else window.history.back();
      });
      cleanup = () => h.remove();
    })();
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform()) return;
    let removed = false;
    const handles: { remove: () => void }[] = [];
    (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted" || removed) return;
      handles.push(
        await PushNotifications.addListener("registration", async ({ value }) => {
          await supabase.rpc("register_push_token" as never, {
            _token: value,
            _platform: Capacitor.getPlatform(),
          } as never);
        }),
        await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
          const link = (a.notification.data?.link as string) || "/notifications";
          navigate(link.startsWith("/") ? link : "/notifications");
        }),
      );
      await PushNotifications.register();
    })().catch((e) => console.warn("[push] registration failed", e));
    return () => {
      removed = true;
      handles.forEach((h) => h.remove());
    };
  }, [user, navigate]);
}
