import { useEffect, useRef, useState } from "react";
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
  const dismissedRef = useRef<Set<string>>(new Set());
  const currentRef = useRef<IncomingCall | null>(null);
  currentRef.current = current;

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let groupIds: string[] = [];
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const hydrate = async (row: {
      id: string;
      group_id: string;
      requested_by: string;
      topic: string | null;
      created_at: string;
    }) => {
      if (dismissedRef.current.has(row.id)) return;
      if (currentRef.current?.id === row.id) return;
      const [{ data: group }, { data: profile }] = await Promise.all([
        supabase.from("groups").select("name").eq("id", row.group_id).maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", row.requested_by)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setCurrent({
        id: row.id,
        group_id: row.group_id,
        group_name: group?.name ?? "Tontine",
        topic: row.topic,
        requested_by: row.requested_by,
        requester_name: profile?.full_name ?? "Un membre",
        created_at: row.created_at,
      });
    };

    const setup = async () => {
      const { data: members } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId)
        .eq("status", "active");
      if (cancelled) return;
      groupIds = (members ?? []).map((m) => m.group_id as string);
      if (groupIds.length === 0) return;

      // Catch-up : récupère un appel pending récent qu'on aurait raté
      // pendant un reload ou une perte de connexion brève.
      const { data: pending } = await supabase
        .from("call_requests")
        .select("id, group_id, requested_by, topic, created_at, status")
        .in("group_id", groupIds)
        .eq("status", "pending")
        .neq("requested_by", userId)
        .gte("created_at", new Date(Date.now() - 60_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (!cancelled && pending && pending[0]) {
        void hydrate(pending[0] as never);
      }

      channel = supabase
        .channel(`incoming-calls:${userId}`)
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
            if (row.requested_by === userId) return;
            if (row.status !== "pending") return;
            void hydrate(row);
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "call_requests" },
          (payload) => {
            const row = payload.new as { id: string; status: string };
            if (currentRef.current?.id === row.id && row.status !== "pending") {
              setCurrent(null);
            }
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[useIncomingCalls] realtime status:", status);
          }
        });
    };

    void setup();

    const onOnline = () => {
      // Reconnexion réseau → on relance setup pour récupérer un appel manqué
      void setup();
    };
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const dismiss = () => {
    if (current) {
      dismissedRef.current.add(current.id);
      setCurrent(null);
    }
  };

  return { current, dismiss };
}