import { AlertTriangle, Download, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DangerZone() {
  const handleExport = () => {
    toast("Export du dossier complet", {
      description: "Pack ZIP signé (CSV + PDF + signatures) délivré sous 72h à votre e-mail vérifié.",
    });
  };

  const handleLogoutEverywhere = () => {
    toast.success("Toutes les sessions ont été révoquées");
  };

  const handleClose = () => {
    toast("Procédure de clôture", {
      description: "Cette action est irréversible. Un agent de conformité vous contactera sous 24h.",
    });
  };

  return (
    <article className="rounded-xl border border-destructive/20 bg-card">
      <header className="border-b border-destructive/20 bg-destructive/5 px-5 py-4 lg:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Zone sensible</h2>
            <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
              Actions irréversibles ou à fort impact opérationnel
            </p>
          </div>
        </div>
      </header>

      <ul className="divide-y divide-border/50">
        <Action
          icon={<Download className="h-4 w-4" />}
          title="Exporter mon dossier complet"
          description="Toutes vos opérations, documents KYC, signatures et journaux sur les 12 derniers mois."
          actionLabel="Préparer l'export"
          variant="muted"
          onAction={handleExport}
        />
        <Action
          icon={<LogOut className="h-4 w-4" />}
          title="Déconnecter tous les appareils"
          description="Force une nouvelle authentification sur l'ensemble des sessions actives, y compris celle-ci."
          actionLabel="Déconnecter partout"
          variant="muted"
          onAction={handleLogoutEverywhere}
        />
        <Action
          icon={<Trash2 className="h-4 w-4" />}
          title="Clôturer mon compte"
          description="Action irréversible. Vos cycles ouverts doivent être clôturés. Un agent de conformité validera la démarche."
          actionLabel="Demander la clôture"
          variant="destructive"
          onAction={handleClose}
        />
      </ul>
    </article>
  );
}

function Action({
  icon,
  title,
  description,
  actionLabel,
  variant,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  variant: "muted" | "destructive";
  onAction: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={
            variant === "destructive"
              ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive"
              : "flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground"
          }
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className={
          variant === "destructive"
            ? "inline-flex h-9 items-center gap-1.5 rounded-md bg-destructive px-4 text-xs font-semibold text-destructive-foreground transition hover:opacity-90"
            : "inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-4 text-xs font-medium text-foreground transition hover:bg-secondary"
        }
      >
        {actionLabel}
      </button>
    </li>
  );
}
