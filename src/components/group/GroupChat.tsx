import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  listGroupMessages,
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
import { supabase } from "@/integrations/supabase/client";
import type { UploadedAttachment } from "@/lib/api/chatAttachments";

interface Props {
  groupId: string;
  /** "page" = surface plein cadre (messagerie), "panel" = carte encastrée (détail groupe). */
  variant?: "page" | "panel";
  groupName?: string;
}

const BURST_WINDOW_MS = 5 * 60 * 1000;

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
  const initialUnreadRef = useRef<{ count: number; firstId: string | null } | null>(null);
  const myName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Membre";

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat", groupId],
    queryFn: () => listGroupMessages(groupId),
  });

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
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    // mark as read peu après que le user ait vu le scroll
    const t = window.setTimeout(() => {
      markGroupRead(groupId).catch(() => {});
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const { typers, notifyTyping } = useTypingChannel(groupId, user?.id ?? null, myName);

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

  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].author_user_id === user?.id) return messages[i].id;
    }
    return null;
  }, [messages, user?.id]);

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
        className={cn(
          "scrollbar-thin flex-1 overflow-y-auto px-3 py-4 lg:px-6",
        )}
      >
        <div className="mx-auto w-full max-w-3xl space-y-1">
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
                  delivered={m.id !== lastMineId}
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
