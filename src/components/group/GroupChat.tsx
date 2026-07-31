import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  listGroupMessagesPage,
  sendGroupMessageV2,
  markGroupRead,
  subscribeGroupMessages,
  type DbGroupMessage,
} from "@/lib/api/chat";
import { TypingIndicator } from "@/components/messages/TypingIndicator";
import { UnreadSeparator } from "@/components/messages/UnreadSeparator";
import { DaySeparator } from "@/components/messages/DaySeparator";
import { MessageBubble } from "@/components/messages/MessageBubble";
import { Composer } from "@/components/messages/Composer";
import { useTypingChannel } from "@/hooks/useTypingChannel";
import { useMessageReceipts } from "@/hooks/useMessageReceipts";
import { supabase } from "@/integrations/supabase/client";
import type { UploadedAttachment } from "@/lib/api/chatAttachments";

interface Props {
  groupId: string;
  /** "page" = surface plein cadre (messagerie), "panel" = carte encastrée (détail groupe). */
  variant?: "page" | "panel";
  groupName?: string;
}

const BURST_WINDOW_MS = 5 * 60 * 1000;
const PAGE_SIZE = 30;
/** Distance (px) sous laquelle on considère l'utilisateur "collé" au bas de la liste. */
const BOTTOM_THRESHOLD = 120;

function scrollKey(groupId: string) {
  return `chat-scroll:${groupId}`;
}

function sameDay(a: string, b: string): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

export function GroupChat({ groupId, variant = "panel", groupName = "" }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<UploadedAttachment | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const restoredRef = useRef(false);
  const initialUnreadRef = useRef<{ count: number; firstId: string | null } | null>(null);
  const myName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Membre";

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat", groupId],
    queryFn: async () => {
      const page = await listGroupMessagesPage(groupId, null, PAGE_SIZE);
      setHasMore(page.hasMore);
      return page.items;
    },
  });

  // Réinitialise l'état de pagination quand on change de conversation.
  useEffect(() => {
    setHasMore(true);
    restoredRef.current = false;
    setAtBottom(true);
    initialUnreadRef.current = null;
  }, [groupId]);

  // Charger last_read_at pour calculer le séparateur "non lus"
  const { data: lastReadAt } = useQuery({
    queryKey: ["chat-last-read", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_message_reads")
        .select("last_read_at")
        .eq("group_id", groupId)
        .maybeSingle();
      return (data?.last_read_at as string | null | undefined) ?? null;
    },
  });

  // Calcule (une fois) l'index du premier message non lu pour le séparateur
  useEffect(() => {
    if (initialUnreadRef.current || messages.length === 0 || !user?.id) return;
    const firstUnread = messages.find(
      (m) =>
        m.author_user_id !== user.id &&
        (!lastReadAt || new Date(m.created_at) > new Date(lastReadAt)),
    );
    if (firstUnread) {
      const count = messages.filter(
        (m) =>
          m.author_user_id !== user.id &&
          (!lastReadAt || new Date(m.created_at) > new Date(lastReadAt)),
      ).length;
      initialUnreadRef.current = { count, firstId: firstUnread.id };
    } else {
      initialUnreadRef.current = { count: 0, firstId: null };
    }
  }, [messages, lastReadAt, user?.id]);

  // Realtime sur les messages du groupe
  useEffect(() => {
    const ch = subscribeGroupMessages(groupId, (msg) => {
      qc.setQueryData<DbGroupMessage[]>(["chat", groupId], (prev = []) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return () => {
      ch.unsubscribe();
    };
  }, [groupId, qc]);

  // Auto-scroll & mark as read
  useEffect(() => {
    const el = listRef.current;
    if (!el || messages.length === 0) return;

    // Première peinture : on restaure la position de lecture mémorisée.
    if (!restoredRef.current) {
      restoredRef.current = true;
      const saved = Number(sessionStorage.getItem(scrollKey(groupId)) ?? "NaN");
      if (Number.isFinite(saved) && saved > 0 && saved < el.scrollHeight) {
        el.scrollTop = saved;
        setAtBottom(el.scrollHeight - saved - el.clientHeight < BOTTOM_THRESHOLD);
      } else {
        el.scrollTop = el.scrollHeight;
      }
    } else if (atBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }

    // On ne marque comme lu que si l'utilisateur voit réellement le bas.
    if (!atBottom) return;
    const t = window.setTimeout(() => {
      markGroupRead(groupId).catch(() => {});
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, groupId, atBottom]);

  // Mémorise la position de lecture (par conversation) et l'état "bas de liste".
  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    sessionStorage.setItem(scrollKey(groupId), String(el.scrollTop));
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD);
  };

  // Chargement infini vers le haut, en conservant la position visuelle.
  const loadOlder = async () => {
    const el = listRef.current;
    const oldest = messages[0];
    if (!el || !oldest || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;
    try {
      const page = await listGroupMessagesPage(groupId, oldest.created_at, PAGE_SIZE);
      setHasMore(page.hasMore);
      if (page.items.length > 0) {
        qc.setQueryData<DbGroupMessage[]>(["chat", groupId], (prev = []) => {
          const known = new Set(prev.map((m) => m.id));
          return [...page.items.filter((m) => !known.has(m.id)), ...prev];
        });
        requestAnimationFrame(() => {
          if (!listRef.current) return;
          listRef.current.scrollTop = listRef.current.scrollHeight - prevHeight + prevTop;
        });
      }
    } catch {
      /* silencieux : on réessaiera au prochain scroll */
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadOlder();
      },
      { root, rootMargin: "200px 0px 0px 0px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loadingMore, messages.length, groupId]);

  const { typers, notifyTyping, notifyRecording, stopActivity } = useTypingChannel(
    groupId,
    user?.id ?? null,
    myName,
  );
  const { statusOf } = useMessageReceipts(groupId, user?.id ?? null);

  const sendM = useMutation({
    mutationFn: () =>
      sendGroupMessageV2(groupId, {
        body,
        attachment: attachment
          ? {
              url: attachment.url,
              type: attachment.type,
              name: attachment.name,
              size: attachment.size,
            }
          : null,
      }),
    onSuccess: (msg) => {
      setBody("");
      setAttachment(null);
      stopActivity();
      setAtBottom(true);
      qc.setQueryData<DbGroupMessage[]>(["chat", groupId], (prev = []) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    },
    onError: (e: Error) => toast.error("Envoi impossible", { description: e.message }),
  });

  const submit = () => {
    if ((!body.trim() && !attachment) || sendM.isPending) return;
    sendM.mutate();
  };

  const rows = useMemo(() => {
    return messages.map((m, idx) => {
      const prev = messages[idx - 1];
      const next = messages[idx + 1];
      const newDay = !prev || !sameDay(prev.created_at, m.created_at);
      const burstWithPrev =
        !!prev &&
        !newDay &&
        prev.author_user_id === m.author_user_id &&
        new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < BURST_WINDOW_MS;
      const burstWithNext =
        !!next &&
        sameDay(next.created_at, m.created_at) &&
        next.author_user_id === m.author_user_id &&
        new Date(next.created_at).getTime() - new Date(m.created_at).getTime() < BURST_WINDOW_MS;
      return { m, newDay, showName: !burstWithPrev, showAvatar: !burstWithNext, isLastOfBurst: !burstWithNext };
    });
  }, [messages]);

  const isPage = variant === "page";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden",
        isPage ? "h-full" : "h-[60vh] rounded-xl border border-hairline",
        "chat-wallpaper",
      )}
    >
      <div
        ref={listRef}
        onScroll={handleScroll}
        className={cn(
          "scrollbar-thin flex-1 overflow-y-auto px-3 py-4 lg:px-6",
        )}
      >
        <div className="mx-auto w-full max-w-3xl space-y-1">
          <div ref={topSentinelRef} aria-hidden className="h-px w-full" />
          {hasMore && !isLoading && (
            <div className="flex justify-center py-2 text-xs text-muted-foreground">
              {loadingMore ? "Chargement des messages…" : "Faites défiler pour voir l'historique"}
            </div>
          )}
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="h-7 w-7 animate-pulse rounded-full bg-secondary" />
                <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-secondary" />
              </div>
            ))}

          {!isLoading && messages.length === 0 && (
            <div className="flex h-full items-center justify-center py-16">
              <p className="chat-bubble-shadow rounded-full bg-chat-in px-4 py-2 text-xs text-muted-foreground">
                Aucun message — lancez la discussion
              </p>
            </div>
          )}

          {rows.map(({ m, newDay, showName, showAvatar, isLastOfBurst }) => {
            const mine = m.author_user_id === user?.id;
            const showUnread =
              initialUnreadRef.current?.firstId === m.id && initialUnreadRef.current.count > 0;
            return (
              <div key={m.id} className={cn(showName ? "pt-2" : "pt-0.5")}>
                {newDay && <DaySeparator iso={m.created_at} />}
                {showUnread && <UnreadSeparator count={initialUnreadRef.current!.count} />}
                <MessageBubble
                  message={m}
                  mine={mine}
                  groupName={groupName}
                  showAvatar={showAvatar}
                  showName={showName}
                  isLastOfBurst={isLastOfBurst}
                  receipt={mine ? statusOf(m.created_at) : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>

      <TypingIndicator typers={typers} />

      <Composer
        groupId={groupId}
        body={body}
        onBodyChange={(v) => {
          setBody(v);
          notifyTyping();
        }}
        attachment={attachment}
        onAttachmentChange={setAttachment}
        onSubmit={submit}
        pending={sendM.isPending}
        onRecordingActivity={notifyRecording}
        onRecorded={(a) => {
          sendGroupMessageV2(groupId, {
            body: "",
            attachment: { url: a.url, type: a.type, name: a.name, size: a.size },
          })
            .then((msg) => {
              qc.setQueryData<DbGroupMessage[]>(["chat", groupId], (prev = []) => {
                if (prev.some((x) => x.id === msg.id)) return prev;
                return [...prev, msg];
              });
            })
            .catch((e: Error) => toast.error("Envoi impossible", { description: e.message }));
        }}
      />
    </div>
  );
}
