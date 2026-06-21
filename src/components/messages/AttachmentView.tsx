import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { getAttachmentSignedUrl } from "@/lib/api/chatAttachments";

interface Props {
  path: string;
  type: string;
  name: string;
  size: number | null;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export function AttachmentView({ path, type, name, size }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAttachmentSignedUrl(path)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path]);

  const isImg = type.startsWith("image/");

  if (isImg) {
    return (
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block overflow-hidden rounded-lg border border-hairline"
      >
        {url ? (
          <img
            src={url}
            alt={name}
            className="max-h-60 w-auto max-w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-32 w-48 animate-pulse bg-secondary" />
        )}
      </a>
    );
  }

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="mt-1 flex items-center gap-3 rounded-lg border border-hairline bg-card px-3 py-2 transition hover:bg-secondary"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{name}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {size ? formatBytes(size) : "PDF"} · Ouvrir
        </p>
      </div>
      <Download className="h-4 w-4 text-muted-foreground" />
    </a>
  );
}