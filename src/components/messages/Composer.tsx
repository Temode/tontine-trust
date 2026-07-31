import { useEffect, useRef } from "react";
import { FileText, Image as ImageIcon, Send, X } from "lucide-react";
import { AttachmentPicker } from "./AttachmentPicker";
import { VoiceRecorder } from "./VoiceRecorder";
import type { UploadedAttachment } from "@/lib/api/chatAttachments";

interface Props {
  groupId: string;
  body: string;
  onBodyChange: (v: string) => void;
  attachment: UploadedAttachment | null;
  onAttachmentChange: (a: UploadedAttachment | null) => void;
  onSubmit: () => void;
  onRecorded: (a: UploadedAttachment) => void;
  pending: boolean;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export function Composer({
  groupId,
  body,
  onBodyChange,
  attachment,
  onAttachmentChange,
  onSubmit,
  onRecorded,
  pending,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const canSend = Boolean(body.trim() || attachment);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [body]);

  return (
    <div className="border-t border-hairline bg-chat-surface px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2.5">
      {attachment && (
        <div className="mx-auto mb-2 flex w-full max-w-3xl items-center gap-2 rounded-xl border border-hairline bg-card px-3 py-2 text-xs">
          {attachment.type.startsWith("image/") ? (
            <ImageIcon className="h-4 w-4 text-primary" />
          ) : (
            <FileText className="h-4 w-4 text-primary" />
          )}
          <span className="max-w-[200px] truncate text-foreground">{attachment.name}</span>
          <span className="tabular-nums text-muted-foreground">
            {formatBytes(attachment.size)}
          </span>
          <button
            type="button"
            onClick={() => onAttachmentChange(null)}
            className="ml-auto text-muted-foreground transition hover:text-destructive"
            aria-label="Retirer la pièce jointe"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend && !pending) onSubmit();
        }}
        className="mx-auto flex w-full max-w-3xl items-end gap-2"
      >
        <div className="flex flex-1 items-end gap-1 rounded-[1.4rem] bg-card px-2 py-1.5 shadow-soft ring-1 ring-border/60">
          <AttachmentPicker
            groupId={groupId}
            value={attachment}
            onChange={onAttachmentChange}
            disabled={pending}
            iconOnly
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
          />
          <textarea
            ref={taRef}
            rows={1}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend && !pending) onSubmit();
              }
            }}
            placeholder="Entrez un message"
            maxLength={2000}
            aria-label="Message"
            className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent px-1 py-1.5 text-[15px] leading-[1.4] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {canSend ? (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-primary transition hover:bg-primary-700 disabled:opacity-50"
            aria-label="Envoyer"
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <div className="flex h-11 shrink-0 items-center">
            <VoiceRecorder groupId={groupId} disabled={pending} onRecorded={onRecorded} />
          </div>
        )}
      </form>
    </div>
  );
}