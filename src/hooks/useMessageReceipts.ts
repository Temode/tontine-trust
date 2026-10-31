import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listGroupMembers } from "@/lib/api/members";

export type ReceiptStatus = "sent" | "delivered" | "read";

interface ReadRow {
  user_id: string;
  last_read_at: string;
}

/**
 * Accusés type WhatsApp calculés à partir de `group_message_reads` :
 * - `sent`      : aucun autre membre n'a encore ouvert la discussion depuis l'envoi
 * - `delivered` : une partie des membres a vu le message
 * - `read`      : tous les autres membres actifs l'ont vu
 */
export function useMessageReceipts(groupId: string, myUserId: string | null) {
  const qc = useQueryClient();

  const { data: reads = [] } = useQuery({
    queryKey: ["chat-receipts", groupId],
    queryFn: async (): Promise<ReadRow[]> => {
      const { data, error } = await supabase
        .from("group_message_reads")
        .select("user_id, last_read_at")
        .eq("group_id", groupId);
      if (error) throw error;
      return (data ?? []) as ReadRow[];
    },
    enabled: Boolean(groupId),
    staleTime: 5_000,
  });

  const { data: audienceCount = 0 } = useQuery({
    queryKey: ["chat-audience", groupId, myUserId],
    queryFn: async () => {
      const members = await listGroupMembers(groupId);
      return members.filter((m) => m.status === "active" && m.user_id !== myUserId).length;
    },
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!groupId) return;
    const ch = supabase
      .channel(`receipts:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_message_reads",
          filter: `group_id=eq.${groupId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["chat-receipts", groupId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [groupId, qc]);

  const statusOf = useCallback(
    (createdAt: string): { status: ReceiptStatus; seenBy: number; audience: number } => {
      const t = new Date(createdAt).getTime();
      const seenBy = reads.filter(
        (r) => r.user_id !== myUserId && new Date(r.last_read_at).getTime() >= t,
      ).length;
      const audience = audienceCount;
      if (seenBy === 0) return { status: "sent", seenBy, audience };
      if (audience > 0 && seenBy >= audience) return { status: "read", seenBy, audience };
      return { status: "delivered", seenBy, audience };
    },
    [reads, myUserId, audienceCount],
  );

  return { statusOf };
}
