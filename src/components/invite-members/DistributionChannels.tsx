import { Copy, Download, MessageSquare, QrCode, RefreshCcw, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { QrCodeSvg } from "./QrCodeSvg";

interface DistributionChannelsProps {
  inviteCode: string;
  groupName: string;
  onRegenerate: () => void;
  onOpenCompose: () => void;
}

export function DistributionChannels({
  inviteCode,
  groupName,
  onRegenerate,
  onOpenCompose,
}: DistributionChannelsProps) {
  const link = `https://tontine.digital/join/${inviteCode.replace(/-/g, "")}`;
  const shareText = `Rejoignez la tontine ${groupName} sur Tontine Digital · code ${inviteCode}`;

  const copyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    toast.success(`${label} copié`, { description: text.length > 60 ? `${text.slice(0, 60)}…` : text });
  };

  const handleShare = async (platform: "whatsapp" | "telegram" | "share") => {
    const message = `${shareText}\n${link}`;
    if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
      return;
    }
    if (platform === "telegram") {
      window.open(
        `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`,
        "_blank",
      );
      return;
    }
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `Tontine Digital · ${groupName}`, text: shareText, url: link });
      } catch {
        /* user cancelled */
      }
    } else {
      copyText(message, "Message d'invitation");
    }
  };

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Canaux de distribution</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Quatre vecteurs pour placer votre émission auprès des bons souscripteurs
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCompose}
          className="hidden items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 sm:inline-flex"
        >
          <Send className="h-3.5 w-3.5" />
          Composer
        </button>
      </header>

      <div className="grid grid-cols-1 gap-px bg-border lg:grid-cols-2">
        {/* Code direct */}
        <section className="bg-card p-5 lg:p-6">
          <ChannelHeader
            icon={<QrCode className="h-4 w-4" />}
            title="Code direct"
            hint="Identifiant unique du groupe — communiquez-le verbalement ou par message."
          />
          <div className="mt-4 rounded-lg border border-hairline bg-secondary/30 p-4">
            <p className="font-mono text-2xl font-bold tracking-[0.18em] text-foreground num">
              {inviteCode}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => copyText(inviteCode, "Code")}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-card px-2.5 text-xs font-medium text-foreground transition hover:bg-secondary"
              >
                <Copy className="h-3.5 w-3.5" />
                Copier
              </button>
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-card px-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Régénérer
              </button>
            </div>
          </div>
        </section>

        {/* Lien partageable */}
        <section className="bg-card p-5 lg:p-6">
          <ChannelHeader
            icon={<Share2 className="h-4 w-4" />}
            title="Lien partageable"
            hint="URL signée auto-vérifiable. Idéale pour les groupes WhatsApp et les e-mails."
          />
          <div className="mt-4 rounded-lg border border-hairline bg-secondary/30 p-4">
            <p className="truncate font-mono text-xs text-foreground">{link}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => copyText(link, "Lien")}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-hairline bg-card px-2.5 text-xs font-medium text-foreground transition hover:bg-secondary"
              >
                <Copy className="h-3.5 w-3.5" />
                Lien
              </button>
              <button
                type="button"
                onClick={() => handleShare("whatsapp")}
                className="inline-flex h-8 items-center justify-center rounded-md border border-hairline bg-card text-xs font-medium text-foreground transition hover:bg-secondary"
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => handleShare("telegram")}
                className="inline-flex h-8 items-center justify-center rounded-md border border-hairline bg-card text-xs font-medium text-foreground transition hover:bg-secondary"
              >
                Telegram
              </button>
            </div>
          </div>
        </section>

        {/* QR Code */}
        <section className="bg-card p-5 lg:p-6">
          <ChannelHeader
            icon={<QrCode className="h-4 w-4" />}
            title="QR Code"
            hint="À afficher en boutique ou sur une affiche. Scannable depuis l'application Tontine Digital."
          />
          <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-hairline bg-secondary/30 p-4 sm:flex-row sm:items-start">
            <div className="rounded-md border border-hairline bg-card p-2">
              <QrCodeSvg value={inviteCode} size={144} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                Pointez vers <span className="font-mono text-foreground">{inviteCode}</span> ·{" "}
                {link.replace("https://", "")}
              </p>
              <button
                type="button"
                onClick={() =>
                  toast("Téléchargement du QR", {
                    description: "L'export PNG / PDF sera disponible dans la prochaine livraison.",
                  })
                }
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-card px-2.5 text-xs font-medium text-foreground transition hover:bg-secondary"
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger
              </button>
            </div>
          </div>
        </section>

        {/* SMS / Compose */}
        <section className="bg-card p-5 lg:p-6">
          <ChannelHeader
            icon={<MessageSquare className="h-4 w-4" />}
            title="Envoi groupé SMS"
            hint="Message-type pré-renseigné. Émission notifiée par SMS sécurisé via Orange / MTN."
          />
          <div className="mt-4 rounded-lg border border-hairline bg-secondary/30 p-4 text-xs text-foreground">
            <p>
              Bonjour, je vous invite à rejoindre la tontine{" "}
              <span className="font-semibold">« {groupName} »</span> sur Tontine Digital.
            </p>
            <p className="mt-2 font-mono">Code : {inviteCode}</p>
            <p className="mt-1 font-mono">{link}</p>
          </div>
          <button
            type="button"
            onClick={onOpenCompose}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
          >
            <Send className="h-3.5 w-3.5" />
            Composer une diffusion
          </button>
        </section>
      </div>
    </article>
  );
}

function ChannelHeader({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <header>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">{hint}</p>
    </header>
  );
}
