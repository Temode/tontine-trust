import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToMyNotifications } from "@/lib/api/notifications";

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
      toast(n.title, { description: n.body ?? undefined });
    });
    return () => {
      channel.unsubscribe();
    };
  }, [user, qc]);
}