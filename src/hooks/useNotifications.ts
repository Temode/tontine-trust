import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { KINDS_WITH_OWN_IN_APP_ALERT, subscribeToMyNotifications } from "@/lib/api/notifications";
import { supabase } from "@/integrations/supabase/client";

/**
 * Souscrit aux notifications temps réel et invalide les caches pertinents.
 * À monter une seule fois (dans AppShell).
 */
export function useNotificationsRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const channel = subscribeToMyNotifications(user.id, (n) => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      if (KINDS_WITH_OWN_IN_APP_ALERT.has(n.kind)) return;
      toast(n.title, { description: n.body ?? undefined });
    });
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        channel.unsubscribe();
      }
    };
  }, [user, qc]);
}