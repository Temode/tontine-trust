import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import { AttachmentView } from "./AttachmentView";
import { MessageText } from "./MessageText";
import { CallEventCard, extractCallId } from "./CallEventCard";
import type { DbGroupMessage } from "@/lib/api/chat";

interface Props {
  message: DbGroupMessage;
  mine: boolean;
  groupName: string;
  showAvatar: boolean;
  showName: boolean;
  isLastOfBurst: boolean;
  delivered: boolean;
}

export function MessageBubble({
  message: m,
  mine,
  groupName,
  showAvatar,
  showName,
  isLastOfBurst,
  delivered,
}: Props) {
  const name = m.author?.full_name?.trim() || "Membre";
  const initials = getInitials(name) || "··";
  const callId = extractCallId(m.body);
  const time = new Date(m.created_at).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
      <div className="w-7 shrink-0">
        {showAvatar && !mine && (
          <div className="flex h-7 w-7 overflow-hidden rounded-full bg-secondary">
            {m.author?.avatar_url ? (
              <img src={m.author.avatar_url} alt={name} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-foreground">
                {initials}
              </span>
            )}
          </div>
        )}
      </div>

      {callId ? (
        <CallEventCard
          callId={callId}
          groupId={m.group_id}
          groupName={groupName}
          authorName={mine ? "Vous" : name}
          createdAt={m.created_at}
          mine={mine}
        />
      ) : (
        <div
          className={cn(
            "chat-bubble-shadow relative max-w-[min(68%,34rem)] rounded-2xl px-2.5 py-1.5",
            mine
              ? "bg-chat-out text-chat-out-foreground"
              : "bg-chat-in text-chat-in-foreground",
            isLastOfBurst && (mine ? "rounded-br-md" : "rounded-bl-md"),
          )}
        >
          {showName && !mine && (
            <p className="mb-0.5 text-[12.5px] font-semibold text-primary">{name}</p>
          )}
          {m.attachment_url && (
            <AttachmentView
              path={m.attachment_url}
              type={m.attachment_type ?? "application/octet-stream"}
              name={m.attachment_name ?? "Pièce jointe"}
              size={m.attachment_size}
            />
          )}
          {m.body && m.body.trim() ? (
            <MessageText body={m.body} mine={mine} />
          ) : null}
          <span
            className={cn(
              "float-right ml-2 mt-0.5 flex translate-y-1 items-center gap-0.5 text-[11px] tabular-nums",
              mine ? "text-chat-out-foreground/70" : "text-muted-foreground",
            )}
          >
            {time}
            {mine &&
              (delivered ? (
                <CheckCheck className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              ))}
          </span>
          <span className="clear-both block" />
        </div>
      )}
    </div>
  );
}