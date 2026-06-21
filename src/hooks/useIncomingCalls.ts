import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface IncomingCall {
  id: string;
  group_id: string;
  group_name: string;
  topic: string | null;
  requested_by: string;
  requester_name: string;
  created_at: string;
}

export function useIncomingCalls(): {
  current: IncomingCall | null;
  dismiss: () => void;
} {
  const { user } = useAuth();
  const [current, setCurrent] = useState<IncomingCall | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    let groupIds: string[] = [];
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: members } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("status", "active");
      groupIds = (members ?? []).map((m) => m.group_id as string);
      if (groupIds.length === 0) return;

      channel = supabase
        .channel("incoming-calls")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "call_requests" },
          async (payload) => {
            const row = payload.new as {
              id: string;
              group_id: string;
              requested_by: string;
              topic: string | null;
              status: string;
              created_at: string;
            };
            if (!groupIds.includes(row.group_id)) return;
            if (row.requested_by === user.id) return;
            if (row.status !== "pending") return;
            if (dismissed.has(row.id)) return;

            const [{ data: group }, { data: profile }] = await Promise.all([
              supabase.from("groups").select("name").eq("id", row.group_id).maybeSingle(),
              supabase
                .from("profiles")
                .select("full_name")
                .eq("id", row.requested_by)
                .maybeSingle(),
            ]);

            setCurrent({
              id: row.id,
              group_id: row.group_id,
              group_name: group?.name ?? "Tontine",
              topic: row.topic,
              requested_by: row.requested_by,
              requester_name: profile?.full_name ?? "Un membre",
              created_at: row.created_at,
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "call_requests" },
          (payload) => {
            const row = payload.new as { id: string; status: string };
            if (current?.id === row.id && row.status !== "pending") {
              setCurrent(null);
            }
          },
        )
        .subscribe();
    };

    void load();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, current?.id, dismissed]);

  const dismiss = () => {
    if (current) {
      setDismissed((s) => new Set(s).add(current.id));
      setCurrent(null);
    }
  };

  return { current, dismiss };
}