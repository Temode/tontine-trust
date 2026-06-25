import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import {
  listGroupMessages,
  sendGroupMessageV2,
  markGroupRead,
  subscribeGroupMessages,
  type DbGroupMessage,
} from "@/lib/api/chat";
import { AttachmentPicker } from "@/components/messages/AttachmentPicker";
import { AttachmentView } from "@/components/messages/AttachmentView";
import { VoiceRecorder } from "@/components/messages/VoiceRecorder";
import { TypingIndicator } from "@/components/messages/TypingIndicator";
import { UnreadSeparator } from "@/components/messages/UnreadSeparator";
import { useTypingChannel } from "@/hooks/useTypingChannel";
import { supabase } from "@/integrations/supabase/client";
import type { UploadedAttachment } from "@/lib/api/chatAttachments";

interface Props {
  groupId: string;
}

export function GroupChat({ groupId }: Props) {
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = body.trim();
    if ((!v && !attachment) || sendM.isPending) return;
    sendM.mutate();
  };

  return (
    <div className="flex h-[60vh] flex-col overflow-hidden rounded-xl border border-hairline bg-card">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="space-y-3 px-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
                <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-secondary" />
              </div>
            ))}
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Aucun message. Lancez la discussion !
          </p>
        )}
        {messages.map((m, idx) => {
          const mine = m.author_user_id === user?.id;
          const name = m.author?.full_name?.trim() || "Membre";
          const initials = getInitials(name) || "··";
          const showUnread =
            initialUnreadRef.current?.firstId === m.id &&
            initialUnreadRef.current.count > 0;
          const prev = messages[idx - 1];
          const sameAuthorAsPrev = prev && prev.author_user_id === m.author_user_id;
          const isLastFromMe =
            mine && messages.slice(idx + 1).every((x) => x.author_user_id !== user?.id);
          const readByOthers =
            isLastFromMe && false; // serveur ne suit pas par message ; pour v1, on affiche CheckCheck si message ancien
          // Heuristique : on considère "lu" si message vieux de >2s ET pas le dernier de la list (le récepteur ouvre la conv)
          return (
            <div key={m.id}>
              {showUnread && <UnreadSeparator count={initialUnreadRef.current!.count} />}
              <div
                className={cn(
                  "flex items-end gap-2",
                  mine && "flex-row-reverse",
                  sameAuthorAsPrev && "mt-0.5",
                )}
              >
              <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-secondary">
                {m.author?.avatar_url ? (
                  <img src={m.author.avatar_url} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-foreground">
                    {initials}
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                  mine
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-secondary text-foreground",
                )}
              >
                {!mine && !sameAuthorAsPrev && (
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {name}
                  </p>
                )}
                {m.attachment_url && (
                  <AttachmentView
                    path={m.attachment_url}
                    type={m.attachment_type ?? "application/octet-stream"}
                    name={m.attachment_name ?? "Pièce jointe"}
                    size={m.attachment_size}
                  />
                )}
                {m.body && m.body.trim() && (
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                )}
                <div
                  className={cn(
                    "mt-1 flex items-center gap-1 text-[10px] tabular-nums",
                    mine ? "justify-end text-primary-100/80" : "text-muted-foreground",
                  )}
                >
                  <span>
                    {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  </span>
                  {mine && (
                    readByOthers ? (
                      <CheckCheck className="h-3 w-3 text-accent" />
                    ) : isLastFromMe ? (
                      <CheckCheck className="h-3 w-3" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )
                  )}
                </div>
              </div>
              </div>
            </div>
          );
        })}
      </div>
      <TypingIndicator typers={typers} />
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-hairline bg-card px-3 py-2">
        <AttachmentPicker
          groupId={groupId}
          value={attachment}
          onChange={setAttachment}
          disabled={sendM.isPending}
        />
        <VoiceRecorder
          groupId={groupId}
          disabled={sendM.isPending}
          onRecorded={(a) => {
            sendGroupMessageV2(groupId, {
              body: "",
              attachment: { url: a.url, type: a.type, name: a.name, size: a.size },
            })
              .then((msg) => {
                qc.setQueryData<DbGroupMessage[]>(["chat", groupId], (prev = []) => {
                  if (prev.some((m) => m.id === msg.id)) return prev;
                  return [...prev, msg];
                });
              })
              .catch((e: Error) =>
                toast.error("Envoi impossible", { description: e.message }),
              );
          }}
        />
        <input
          type="text"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            notifyTyping();
          }}
          placeholder="Votre message…"
          maxLength={2000}
          className="flex-1 rounded-md border border-hairline bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          aria-label="Message"
        />
        <button
          type="submit"
          disabled={sendM.isPending || (!body.trim() && !attachment)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          aria-label="Envoyer"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}