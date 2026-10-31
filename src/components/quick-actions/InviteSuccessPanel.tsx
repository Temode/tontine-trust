import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  QrCode,
  RefreshCcw,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { QrCodeSvg } from "@/components/invite-members/QrCodeSvg";
import { createInvitation } from "@/lib/api/invitations";
import { buildInviteUrl } from "@/lib/validation/policy";
import { cn } from "@/lib/utils";

interface InviteSuccessPanelProps {
  groupId: string;
  groupName?: string;
  initialCode: string;
  /** Called when user wants to navigate to the group. */
  onViewGroup: () => void;
  /** Called to dismiss / close the panel. */
  onClose?: () => void;
}

/** Limite côté client pour éviter la fuite accidentelle / le bruit d'audit. */
const MAX_REGENERATIONS = 3;

/** Masque un code TD-XXXX-XXXX en TD-••••-•••• tout en gardant la longueur. */
function maskCode(code: string): string {
  return code.replace(/[A-Z0-9]/g, (c, i) => (i < 2 ? c : "•"));
}

/**
 * Panneau « invite-after-create » réutilisable :
 * - Code masqué par défaut + bouton afficher / masquer
 * - Copie avec feedback visuel immédiat (icône check, état "Copié")
 * - Compteur de régénération bridé à {@link MAX_REGENERATIONS}
 * - Lien d'invitation + copie + partage natif / WhatsApp / SMS / Email
 * - QR code
 */
export function InviteSuccessPanel({
  groupId,
  groupName,
  initialCode,
  onViewGroup,
  onClose,
}: InviteSuccessPanelProps) {
  const [code, setCode] = useState(initialCode);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [regenCount, setRegenCount] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const copyCodeTimer = useRef<number | null>(null);
  const copyLinkTimer = useRef<number | null>(null);

  useEffect(() => {
    setCode(initialCode);
    setRevealed(false);
  }, [initialCode]);

  useEffect(() => {
    return () => {
      if (copyCodeTimer.current) window.clearTimeout(copyCodeTimer.current);
      if (copyLinkTimer.current) window.clearTimeout(copyLinkTimer.current);
    };
  }, []);

  const inviteUrl = useMemo(() => buildInviteUrl(code), [code]);
  const displayCode = revealed ? code : maskCode(code);
  const remainingRegens = Math.max(0, MAX_REGENERATIONS - regenCount);
  const canRegen = !regenerating && remainingRegens > 0;

  const shareMessage = useMemo(
    () =>
      `Rejoignez notre tontine${groupName ? ` « ${groupName} »` : ""} sur Tontine Digitale.\nCode : ${code}\nLien : ${inviteUrl}`,
    [groupName, code, inviteUrl],
  );

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      toast.success("Code copié dans le presse-papiers");
      if (copyCodeTimer.current) window.clearTimeout(copyCodeTimer.current);
      copyCodeTimer.current = window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error("Impossible de copier le code");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      toast.success("Lien copié");
      if (copyLinkTimer.current) window.clearTimeout(copyLinkTimer.current);
      copyLinkTimer.current = window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Tontine Digitale", text: shareMessage, url: inviteUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      handleCopyLink();
    }
  };

  const handleRegenerate = async () => {
    if (!canRegen) return;
    setRegenerating(true);
    setRegenError(null);
    try {
      const inv = await createInvitation({ groupId });
      setCode(inv.code);
      setRevealed(false);
      setRegenCount((n) => n + 1);
      toast.success("Nouveau code généré");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de la régénération";
      setRegenError(msg);
      toast.error("Erreur", { description: msg });
    } finally {
      setRegenerating(false);
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const smsUrl = `sms:?&body=${encodeURIComponent(shareMessage)}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent("Invitation Tontine Digitale")}&body=${encodeURIComponent(shareMessage)}`;

  return (
    <div className="flex flex-col">
      {/* Hero strip */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-700 px-6 py-6 text-primary-foreground">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent/30 blur-3xl" />
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-foreground/80">
          Tontine créée
        </p>
        <h3 className="mt-1 font-display text-2xl font-bold leading-tight">
          Invitez vos membres
        </h3>
        {groupName && (
          <p className="mt-1 truncate text-sm text-primary-foreground/85">{groupName}</p>
        )}
      </div>

      <div className="space-y-5 px-6 py-5">
        {/* Code copy block */}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Code d'invitation
            </p>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-pressed={revealed}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {revealed ? "Masquer" : "Afficher"}
            </button>
          </div>
          <div className="mt-1.5 flex items-stretch gap-2">
            <div
              className={cn(
                "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-hairline bg-secondary/40 font-display text-lg font-bold tracking-[0.25em] text-foreground transition",
                !revealed && "select-none",
              )}
              aria-live="polite"
            >
              {!revealed && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
              <span className="num">{displayCode}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              aria-label={copiedCode ? "Code copié" : "Copier le code"}
              className={cn(
                "inline-flex h-12 items-center gap-1.5 rounded-xl border px-4 text-xs font-semibold transition",
                copiedCode
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-hairline bg-card text-foreground hover:bg-secondary",
              )}
            >
              {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedCode ? "Copié" : "Copier"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Le code reste masqué tant que vous ne cliquez pas sur « Afficher ». La copie fonctionne même masquée.
          </p>
        </div>

        {/* Link copy block */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Lien d'invitation
          </p>
          <div className="mt-1.5 flex items-stretch gap-2">
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 truncate rounded-xl border border-hairline bg-card px-3 text-xs text-muted-foreground">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono text-foreground">
                {revealed ? inviteUrl : inviteUrl.replace(/code=.+$/, "code=••••-••••")}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              aria-label={copiedLink ? "Lien copié" : "Copier le lien"}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition",
                copiedLink
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-hairline bg-card text-foreground hover:bg-secondary",
              )}
            >
              {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Share channels */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ShareButton
            label="Partager"
            icon={<Share2 className="h-4 w-4" />}
            onClick={handleNativeShare}
            primary
          />
          <ShareButton
            label="WhatsApp"
            icon={<MessageCircle className="h-4 w-4" />}
            href={whatsappUrl}
          />
          <ShareButton label="SMS" icon={<MessageCircle className="h-4 w-4" />} href={smsUrl} />
          <ShareButton label="Email" icon={<Mail className="h-4 w-4" />} href={mailUrl} />
        </div>

        {/* QR code */}
        <div>
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <QrCode className="h-3.5 w-3.5" />
            {showQr ? "Masquer le QR code" : "Afficher le QR code"}
          </button>
          {showQr && (
            <div className="mt-3 flex justify-center rounded-xl border border-hairline bg-card p-4">
              <QrCodeSvg value={inviteUrl} size={176} />
            </div>
          )}
        </div>

        {/* Regenerate */}
        <div className="flex items-center justify-between rounded-xl border border-hairline bg-secondary/30 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Code expiré ou déjà utilisé ?</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Régénérations utilisées :{" "}
              <span className="num font-semibold text-foreground">
                {regenCount} / {MAX_REGENERATIONS}
              </span>
              {remainingRegens === 0 && " — limite atteinte pour cette session."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={!canRegen}
            title={remainingRegens === 0 ? "Limite de régénérations atteinte" : undefined}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-card/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {regenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            Régénérer
          </button>
        </div>
        {regenError && (
          <p className="text-xs text-destructive">{regenError}</p>
        )}
      </div>

      <footer className="flex flex-col-reverse items-stretch gap-2 border-t border-hairline bg-card/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-hairline bg-card px-4 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            Fermer
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onViewGroup}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-700"
        >
          Voir la tontine
          <ArrowRight className="h-4 w-4" />
        </button>
      </footer>
    </div>
  );
}

function ShareButton({
  label,
  icon,
  onClick,
  href,
  primary,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
}) {
  const base = cn(
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition",
    primary
      ? "border-primary bg-primary text-primary-foreground hover:bg-primary-700"
      : "border-hairline bg-card text-foreground hover:bg-secondary",
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={base}>
        {icon}
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={base}>
      {icon}
      {label}
    </button>
  );
}

/** Petit indicateur visuel utilisé ailleurs pour confirmer une copie réussie. */
export function CopyOk() {
  return <Check className="h-3.5 w-3.5 text-success" aria-hidden />;
}