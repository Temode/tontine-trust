import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import {
  listGroupMessages,
  sendGroupMessage,
  subscribeGroupMessages,
  type DbGroupMessage,
} from "@/lib/api/chat";

interface Props {
  groupId: string;
}

export function GroupChat({ groupId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat", groupId],
    queryFn: () => listGroupMessages(groupId),
  });

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

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const sendM = useMutation({
    mutationFn: (b: string) => sendGroupMessage(groupId, b),
    onSuccess: (msg) => {
      setBody("");
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
    if (!v || sendM.isPending) return;
    sendM.mutate(v);
  };

  return (
    <div className="flex h-[60vh] flex-col overflow-hidden rounded-xl border border-hairline bg-card">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {isLoading && (
          <p className="text-center text-xs text-muted-foreground">Chargement…</p>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Aucun message. Lancez la discussion !
          </p>
        )}
        {messages.map((m) => {
          const mine = m.author_user_id === user?.id;
          const name = m.author?.full_name?.trim() || "Membre";
          const initials = getInitials(name) || "··";
          return (
            <div key={m.id} className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
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
                {!mine && (
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {name}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn("mt-1 text-[10px]", mine ? "text-primary-100/80" : "text-muted-foreground")}>
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-hairline bg-card px-3 py-2">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Votre message…"
          maxLength={2000}
          className="flex-1 rounded-md border border-hairline bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          aria-label="Message"
        />
        <button
          type="submit"
          disabled={sendM.isPending || !body.trim()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          aria-label="Envoyer"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}