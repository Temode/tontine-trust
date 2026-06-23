import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Realtime subscription on tours, contributions and beneficiary balances.
 * Invalidates relevant caches so the UI updates instantly without a reload.
 * Pass a groupId to scope to a single group, or omit it to listen to all.
 */
export function useTontineRealtime(groupId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const channelName = groupId ? `tontine-${groupId}-${suffix}` : `tontine-all-${suffix}`;
    const channel = supabase.channel(channelName);

    const turnsFilter = groupId ? { filter: `group_id=eq.${groupId}` } : {};
    const contribFilter = groupId ? { filter: `group_id=eq.${groupId}` } : {};
    const balancesFilter = groupId ? { filter: `group_id=eq.${groupId}` } : {};
    const withdrawalsFilter = groupId ? { filter: `group_id=eq.${groupId}` } : {};

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "turns", ...turnsFilter },
        () => {
          queryClient.invalidateQueries({ queryKey: ["group", groupId, "turns"] });
          queryClient.invalidateQueries({ queryKey: ["turns"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["contributions", "due"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contributions", ...contribFilter },
        () => {
          queryClient.invalidateQueries({ queryKey: ["contributions", "due"] });
          queryClient.invalidateQueries({ queryKey: ["group", groupId, "turns"] });
          queryClient.invalidateQueries({ queryKey: ["group", groupId, "contributions"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beneficiary_balances", ...balancesFilter },
        () => {
          queryClient.invalidateQueries({ queryKey: ["my-balances"] });
          queryClient.invalidateQueries({ queryKey: ["group", groupId, "balances"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawal_requests", ...withdrawalsFilter },
        () => {
          queryClient.invalidateQueries({ queryKey: ["my-withdrawals"] });
          queryClient.invalidateQueries({ queryKey: ["my-balances"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);
}