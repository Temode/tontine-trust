import { Link } from "react-router-dom";
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
  const preview = lastMessage
    ? `${lastMessage.author?.full_name?.split(" ")[0] ?? "Membre"} : ${lastMessage.body}`
    : "Aucun message — lancez la discussion";
  const time = lastMessage ? formatTime(lastMessage.created_at) : "";

  return (
    <Link
      to={`/discussions/${group.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3 transition-colors",
        active ? "bg-secondary" : "hover:bg-secondary/60",
      )}
    >
      {active && (
        <span aria-hidden className="absolute left-0 top-1/2 h-10 w-[3px] -translate-y-1/2 rounded-r bg-primary" />
      )}
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
          {time && (
            <span
              className={cn(
                "shrink-0 text-[10px] tabular-nums",
                unreadCount > 0 ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {time}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-xs",
              unreadCount > 0 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {preview}
          </p>
          {unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tabular-nums text-accent-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}