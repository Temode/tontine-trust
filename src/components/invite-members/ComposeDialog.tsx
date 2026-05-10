import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Mail, MessageSquare, Send, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ComposeChannel = "sms" | "email";

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  inviteCode: string;
  defaultMessage?: string;
  /** Called once recipients have been "sent". */
  onSent?: (count: number, channel: ComposeChannel) => void;
}

function parseRecipients(raw: string, channel: ComposeChannel): string[] {
  const items = raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (channel === "email") {
    return items.filter((s) => /\S+@\S+\.\S+/.test(s));
  }
  // Phone: keep only digits and a leading +
  return items
    .map((s) => s.replace(/[^+0-9]/g, ""))
    .filter((s) => s.replace(/\D/g, "").length >= 8);
}

export function ComposeDialog({
  open,
  onOpenChange,
  groupName,
  inviteCode,
  defaultMessage,
  onSent,
}: ComposeDialogProps) {
  const [channel, setChannel] = useState<ComposeChannel>("sms");
  const [raw, setRaw] = useState("");
  const [message, setMessage] = useState(defaultMessage ?? "");
  const [step, setStep] = useState<"compose" | "sending" | "sent">("compose");

  useEffect(() => {
    if (open) {
      setStep("compose");
      setRaw("");
      setMessage(defaultMessage ?? "");
      setChannel("sms");
    }
  }, [open, defaultMessage]);

  const recipients = useMemo(() => parseRecipients(raw, channel), [raw, channel]);
  const link = `https://tontine.digital/join/${inviteCode.replace(/-/g, "")}`;
  const fullMessage =
    message ||
    `Bonjour, je vous invite à rejoindre la tontine « ${groupName} » sur Tontine Digital. Code ${inviteCode} — ${link}`;

  const handleSend = () => {
    if (recipients.length === 0) return;
    setStep("sending");
    const t = window.setTimeout(() => {
      setStep("sent");
      onSent?.(recipients.length, channel);
      toast.success(`${recipients.length} ${recipients.length > 1 ? "invitations" : "invitation"} émises`, {
        description: `Diffusion ${channel === "sms" ? "SMS" : "e-mail"} en cours auprès de l'opérateur.`,
      });
      window.setTimeout(() => onOpenChange(false), 900);
    }, 1100);
    return () => window.clearTimeout(t);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92vh] w-full overflow-hidden rounded-t-xl border-x border-t border-hairline bg-card shadow-2xl",
            "data-[state=open]:animate-slide-up data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
            "md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-full md:max-w-xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border",
            "md:data-[state=open]:animate-fade-in",
          )}
        >
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-card/95 px-5 py-4 backdrop-blur lg:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Diffusion
              </p>
              <DialogPrimitive.Title className="font-display text-base font-bold text-foreground lg:text-lg">
                Composer une invitation
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </header>

          <div className="max-h-[calc(92vh-72px)] overflow-y-auto p-5 lg:p-6">
            {step === "compose" && (
              <div className="space-y-5">
                {/* Channel switch */}
                <div className="inline-flex items-center gap-0.5 rounded-md border border-hairline bg-card p-0.5">
                  <ChannelButton
                    active={channel === "sms"}
                    onClick={() => setChannel("sms")}
                    icon={<MessageSquare className="h-3.5 w-3.5" />}
                    label="SMS"
                  />
                  <ChannelButton
                    active={channel === "email"}
                    onClick={() => setChannel("email")}
                    icon={<Mail className="h-3.5 w-3.5" />}
                    label="E-mail"
                  />
                </div>

                {/* Recipients */}
                <div>
                  <label htmlFor="cmp-rcpt" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Destinataires
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {channel === "sms"
                      ? "Numéros séparés par des virgules ou un par ligne. Format international recommandé (+224…)."
                      : "Adresses e-mail séparées par des virgules ou une par ligne."}
                  </p>
                  <textarea
                    id="cmp-rcpt"
                    rows={4}
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    placeholder={
                      channel === "sms"
                        ? "+224 622 14 25 36\n+224 661 02 84 19"
                        : "membre1@exemple.com, membre2@kaloum-corp.gn"
                    }
                    className="mt-2 w-full rounded-md border border-hairline bg-card px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {recipients.length === 0
                      ? "Aucun destinataire valide pour l'instant."
                      : (
                        <>
                          <span className="font-medium text-foreground num">{recipients.length}</span>{" "}
                          {channel === "sms" ? "numéro" : "adresse"}
                          {recipients.length > 1 ? "s" : ""} valide{recipients.length > 1 ? "s" : ""} détecté
                          {recipients.length > 1 ? "s" : ""}.
                        </>
                      )}
                  </p>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="cmp-msg" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Message
                  </label>
                  <textarea
                    id="cmp-msg"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={320}
                    placeholder={fullMessage}
                    className="mt-2 w-full rounded-md border border-hairline bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground num">
                    {(message || fullMessage).length}/320
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={recipients.length === 0}
                  className={cn(
                    "flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold transition",
                    recipients.length > 0
                      ? "bg-primary text-primary-foreground hover:bg-primary-700"
                      : "cursor-not-allowed bg-muted text-muted-foreground",
                  )}
                >
                  <Send className="h-4 w-4" />
                  Émettre {recipients.length > 0 && `(${recipients.length})`}
                </button>

                <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  Diffusion notarisée · facturation incluse dans votre abonnement organisateur
                </p>
              </div>
            )}

            {step === "sending" && (
              <div className="py-12 text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-primary-100 bg-primary-50">
                  <Send className="h-6 w-6 animate-pulse text-primary" />
                </div>
                <h3 className="font-display text-base font-bold text-foreground">Diffusion en cours</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Émission auprès de l'opérateur {channel === "sms" ? "SMS" : "e-mail"} et notarisation des envois…
                </p>
              </div>
            )}

            {step === "sent" && (
              <div className="py-12 text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                  <ShieldCheck className="h-7 w-7" strokeWidth={2.25} />
                </div>
                <h3 className="font-display text-base font-bold text-foreground">Diffusion confirmée</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {recipients.length} {recipients.length > 1 ? "destinataires" : "destinataire"} ont été notifié(s).
                </p>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ChannelButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
