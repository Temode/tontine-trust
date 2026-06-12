import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Link as LinkIcon, MessageCircle, QrCode } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";

export interface ShareSheetProps {
  /** Canonical invitation code, e.g. TD-XXXX-XXXX. */
  code: string;
  /** Group name shown in WhatsApp message body. */
  groupName: string;
  /** Contribution amount in GNF, used in the WhatsApp pitch. */
  contribution?: number;
  /** Frequency label used in the WhatsApp pitch (e.g. "Mensuelle"). */
  frequency?: string;
  /** Optional override for the public join URL prefix. */
  origin?: string;
  className?: string;
}

/**
 * Unified share sheet for an invitation code.
 * Renders a QR code, the public link, and quick-share buttons (WhatsApp + copy).
 */
export function ShareSheet({
  code,
  groupName,
  contribution,
  frequency,
  origin,
  className,
}: ShareSheetProps) {
  const baseOrigin = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const link = useMemo(() => `${baseOrigin}/rejoindre?code=${encodeURIComponent(code)}`, [baseOrigin, code]);

  const message = useMemo(() => {
    const parts = [
      `Bonjour, je vous invite à rejoindre la tontine « ${groupName} » sur Tontine Digital.`,
    ];
    if (contribution && frequency) {
      parts.push(`Cotisation : ${formatGNF(contribution)} GNF · fréquence : ${frequency.toLowerCase()}.`);
    }
    parts.push(`Code : ${code}`);
    parts.push(`Lien : ${link}`);
    return parts.join("\n");
  }, [groupName, contribution, frequency, code, link]);

  const waHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(link, { margin: 1, scale: 6, color: { dark: "#0D7377", light: "#ffffff" } })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [link]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copié`);
    } catch {
      toast.error("Copie impossible");
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
        <div className="flex items-center justify-center rounded-lg border border-hairline bg-card p-3">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Code QR pour rejoindre ${groupName}`}
              className="h-32 w-32 sm:h-36 sm:w-36"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center text-muted-foreground sm:h-36 sm:w-36">
              <QrCode className="h-8 w-8" />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-md border border-hairline bg-secondary/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Code</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="flex-1 truncate font-mono text-lg font-bold tracking-[0.18em] text-foreground num">
                {code}
              </p>
              <button
                type="button"
                onClick={() => copy(code, "Code")}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-hairline bg-card px-2 text-[11px] font-medium text-foreground transition hover:bg-secondary"
              >
                <Copy className="h-3 w-3" /> Copier
              </button>
            </div>
          </div>

          <div className="rounded-md border border-hairline bg-secondary/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Lien</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="flex-1 truncate font-mono text-xs text-foreground">{link}</p>
              <button
                type="button"
                onClick={() => copy(link, "Lien")}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-hairline bg-card px-2 text-[11px] font-medium text-foreground transition hover:bg-secondary"
              >
                <LinkIcon className="h-3 w-3" /> Copier
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 text-sm font-semibold text-white transition hover:brightness-95 sm:flex-none"
        >
          <MessageCircle className="h-4 w-4" />
          Partager via WhatsApp
        </a>
        <button
          type="button"
          onClick={() => copy(message, "Message")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-hairline bg-card px-4 text-sm font-medium text-foreground transition hover:bg-secondary"
        >
          <Copy className="h-4 w-4" />
          Copier le message
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Le destinataire doit créer un compte Tontine Digital pour valider son adhésion. L'organisateur reçoit
        une notification dès qu'une personne rejoint le groupe avec ce code.
      </p>
    </div>
  );
}