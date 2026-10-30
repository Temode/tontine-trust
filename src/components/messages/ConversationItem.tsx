import { Link } from "react-router-dom";
import { FileText, Mic, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import type { ChatConversation } from "@/lib/api/chat";

interface Props {
  conversation: ChatConversation;
  active: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate()
  ) {
    return "Hier";
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function ConversationItem({ conversation, active }: Props) {
  const { group, lastMessage, unreadCount } = conversation;
  const initials = getInitials(group.name) || "··";
  const author = lastMessage?.author?.full_name?.split(" ")[0] ?? "Membre";
  const isVoice = lastMessage?.attachment_type?.startsWith("audio/") ?? false;
  const isFile = !isVoice && Boolean(lastMessage?.attachment_url);
  const isCall = /\/appel\//.test(lastMessage?.body ?? "");
  const PreviewIcon = isVoice ? Mic : isFile ? FileText : isCall ? Phone : null;
  const previewText = lastMessage
    ? isVoice
      ? "Message vocal"
      : isFile
      ? lastMessage.attachment_name ?? "Pièce jointe"
      : isCall
      ? "Appel de groupe"
      : lastMessage.body
    : "Aucun message — lancez la discussion";
  const time = lastMessage ? formatTime(lastMessage.created_at) : "";

  return (
    <Link
      to={`/discussions/${group.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3.5 transition-colors",
        active ? "bg-secondary" : "hover:bg-secondary/60",
      )}
    >
      {active && (
        <span aria-hidden className="absolute left-0 top-1/2 h-10 w-[3px] -translate-y-1/2 rounded-r bg-primary" />
      )}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-semibold text-foreground">{group.name}</p>
          {time && (
            <span
              className={cn(
                "shrink-0 text-[11px] tabular-nums",
                unreadCount > 0 ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {time}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p
            className={cn(
              "flex min-w-0 items-center gap-1 truncate text-[13px]",
              unreadCount > 0 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {PreviewIcon && <PreviewIcon className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">
              {lastMessage ? `${author} : ${previewText}` : previewText}
            </span>
          </p>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}