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
  requester_avatar: string | null;
  created_at: string;
}

export type IncomingCallsStatus =
  | "idle"
  | "connecting"
  | "subscribed"
  | "no_groups"
  | "error"
  | "timeout"
  | "closed";

export interface DiagEvent {
  ts: number;
  type:
    | "status"
    | "insert"
    | "update"
    | "hydrate"
    | "poll"
    | "poll_fallback"
    | "error"
    | "online";
  detail?: string;
}

export function useIncomingCalls(): {
  current: IncomingCall | null;
  dismiss: () => void;
  status: IncomingCallsStatus;
  groupCount: number;
  lastEventAt: number | null;
  pendingCount: number;
  events: DiagEvent[];
} {
  const { user } = useAuth();
  const [current, setCurrent] = useState<IncomingCall | null>(null);
  const [status, setStatus] = useState<IncomingCallsStatus>("idle");
  const [groupCount, setGroupCount] = useState(0);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [events, setEvents] = useState<DiagEvent[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());
  const currentRef = useRef<IncomingCall | null>(null);
  currentRef.current = current;
  const statusRef = useRef<IncomingCallsStatus>("idle");
  statusRef.current = status;
  const groupIdsRef = useRef<string[]>([]);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const pushEvent = (type: DiagEvent["type"], detail?: string) => {
    setEvents((prev) => {
      const next = [...prev, { ts: Date.now(), type, detail }];
      return next.length > 100 ? next.slice(-100) : next;
    });
  };

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
          .select("full_name, avatar_url")
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
        requester_avatar: (profile?.avatar_url as string | null) ?? null,
        created_at: row.created_at,
      });
    };

    const setup = async () => {
      setStatus("connecting");
      pushEvent("status", "connecting");
      const { data: members } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId)
        .eq("status", "active");
      if (cancelled) return;
      groupIds = (members ?? []).map((m) => m.group_id as string);
      groupIdsRef.current = groupIds;
      setGroupCount(groupIds.length);
      if (groupIds.length === 0) {
        setStatus("no_groups");
        pushEvent("status", "no_groups");
        return;
      }

      // Catch-up : récupère un appel pending récent qu'on aurait raté
      // pendant un reload ou une perte de connexion brève.
      const { data: pending } = await supabase
        .from("call_requests")
        .select("id, group_id, requested_by, topic, created_at, status")
        .in("group_id", groupIds)
        .in("status", ["pending", "accepted"])
        .neq("requested_by", userId)
        .gte("created_at", new Date(Date.now() - 60_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (!cancelled && pending && pending[0]) {
        void hydrate(pending[0] as never);
      }

      const channelSuffix =
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      channel = supabase
        .channel(`incoming-calls:${userId}:${channelSuffix}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "call_requests" },
          async (payload) => {
            setLastEventAt(Date.now());
            pushEvent("insert", payload.new && (payload.new as { id: string }).id);
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
            setLastEventAt(Date.now());
            pushEvent(
              "update",
              `${(payload.new as { id: string }).id} → ${(payload.new as { status: string }).status}`,
            );
            const row = payload.new as {
              id: string;
              group_id: string;
              requested_by: string;
              topic: string | null;
              status: string;
              created_at: string;
            };
            const terminal = ["declined", "cancelled", "missed", "ended"].includes(row.status);
            if (currentRef.current?.id === row.id && terminal) {
              setCurrent(null);
            }
            if (
              ["pending", "accepted"].includes(row.status) &&
              groupIds.includes(row.group_id) &&
              row.requested_by !== userId
            ) {
              void hydrate(row);
            }
          },
        )
        .subscribe((s) => {
          if (s === "SUBSCRIBED") setStatus("subscribed");
          else if (s === "CHANNEL_ERROR") setStatus("error");
          else if (s === "TIMED_OUT") setStatus("timeout");
          else if (s === "CLOSED") setStatus("closed");
          pushEvent("status", s);
        });
    };

    void setup();

    const onOnline = () => {
      pushEvent("online");
      // Reconnexion réseau → on relance setup pour récupérer un appel manqué
      void setup();
    };
    window.addEventListener("online", onOnline);

    // ---- Polling adaptatif (fallback Realtime) ----
    // - subscribed     : 60s (filet de sécurité)
    // - connecting     : 5s
    // - error/timeout/closed : 3s (mode dégradé)
    // - no_groups      : aucun poll
    let pollTimer: number | null = null;
    const scheduleNextPoll = () => {
      if (cancelled) return;
      const st = statusRef.current;
      let delay: number | null = 60_000;
      if (st === "no_groups" || st === "idle") delay = null;
      else if (st === "subscribed") delay = 60_000;
      else if (st === "connecting") delay = 5_000;
      else delay = 3_000; // error / timeout / closed
      if (delay === null) return;
      pollTimer = window.setTimeout(runPoll, delay);
    };
    const runPoll = async () => {
      if (cancelled || !userIdRef.current) return;
      const ids = groupIdsRef.current;
      if (ids.length === 0) {
        scheduleNextPoll();
        return;
      }
      try {
        const { data: pending, count } = await supabase
          .from("call_requests")
          .select("id, group_id, requested_by, topic, created_at, status", {
            count: "exact",
          })
          .in("group_id", ids)
          .in("status", ["pending", "accepted"])
          .neq("requested_by", userIdRef.current)
          .order("created_at", { ascending: false })
          .limit(5);
        if (cancelled) return;
        setPendingCount(count ?? (pending?.length ?? 0));
        pushEvent("poll", `pending=${count ?? 0}`);
        // Si Realtime n'est pas opérationnel et qu'un appel existe, on hydrate
        const degraded =
          statusRef.current !== "subscribed" &&
          statusRef.current !== "no_groups";
        if (pending && pending[0]) {
          if (degraded || !currentRef.current) {
            pushEvent("poll_fallback", pending[0].id);
            void hydrate(pending[0] as never);
          }
        }
      } catch (e) {
        pushEvent("error", (e as Error).message);
      } finally {
        scheduleNextPoll();
      }
    };
    pollTimer = window.setTimeout(runPoll, 2_000); // 1er poll après 2s

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      if (pollTimer) window.clearTimeout(pollTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const dismiss = () => {
    if (current) {
      dismissedRef.current.add(current.id);
      setCurrent(null);
    }
  };

  return {
    current,
    dismiss,
    status,
    groupCount,
    lastEventAt,
    pendingCount,
    events,
  };
}