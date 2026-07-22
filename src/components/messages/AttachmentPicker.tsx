import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  uploadChatAttachment,
  type UploadedAttachment,
} from "@/lib/api/chatAttachments";

interface Props {
  groupId: string;
  value: UploadedAttachment | null;
  onChange: (a: UploadedAttachment | null) => void;
  disabled?: boolean;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export function AttachmentPicker({ groupId, value, onChange, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Fichier trop volumineux", { description: "Maximum 8 Mo." });
      return;
    }
    if (!ALLOWED_ATTACHMENT_TYPES.includes(f.type)) {
      toast.error("Format non autorisé", { description: "Images ou PDF uniquement." });
      return;
    }
    setBusy(true);
    try {
      const up = await uploadChatAttachment(groupId, f);
      onChange(up);
    } catch (e) {
      toast.error("Envoi impossible", { description: (e as Error).message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (value) {
    const isImg = value.type.startsWith("image/");
    return (
      <div className="flex items-center gap-2 rounded-md border border-hairline bg-secondary px-2 py-1.5 text-xs">
        {isImg ? (
          <ImageIcon className="h-4 w-4 text-primary" />
        ) : (
          <FileText className="h-4 w-4 text-primary" />
        )}
        <span className="max-w-[160px] truncate text-foreground">{value.name}</span>
        <span className="tabular-nums text-muted-foreground">{formatBytes(value.size)}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 text-muted-foreground hover:text-destructive"
          aria-label="Retirer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => fileRef.current?.click()}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
        aria-label="Joindre un fichier"
        title="Joindre une image ou un PDF (max 8 Mo)"
      >
        <Paperclip className="h-4 w-4" />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={ALLOWED_ATTACHMENT_TYPES.join(",")}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </>
  );
}