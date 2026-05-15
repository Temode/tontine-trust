import { BarChart3, Cookie, Database, Megaphone, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PrivacyToggle {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  defaultValue: boolean;
  /** When true, this toggle cannot be disabled (regulatory requirement). */
  required?: boolean;
}

const PRIVACY_TOGGLES: PrivacyToggle[] = [
  {
    id: "analytics",
    icon: BarChart3,
    label: "Analyse anonymisée d'usage",
    description:
      "Aide à améliorer l'application. Aucune donnée identifiable ni montant n'est transmis aux outils d'analyse.",
    defaultValue: true,
  },
  {
    id: "marketing",
    icon: Megaphone,
    label: "Communications marketing",
    description:
      "Nouveautés produit, offres premium et invitations à des événements. SMS et e-mail.",
    defaultValue: false,
  },
  {
    id: "partners",
    icon: Users,
    label: "Partenaires financiers",
    description:
      "Partage avec partenaires accrédités pour des offres personnalisées (microcrédit, assurance). Aucun partage hors Guinée.",
    defaultValue: false,
  },
  {
    id: "regulatory",
    icon: Database,
    label: "Transmission réglementaire BCG",
    description:
      "Reporting consolidé à la Banque Centrale de Guinée. Obligatoire pour les agréments de paiement.",
    defaultValue: true,
    required: true,
  },
];

export function PrivacySection() {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(PRIVACY_TOGGLES.map((t) => [t.id, t.defaultValue])),
  );

  const handleToggle = (id: string, required?: boolean) => {
    if (required) {
      toast("Préférence obligatoire", {
        description: "Ce partage est exigé par la réglementation BCG-2024-018.",
      });
      return;
    }
    setState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">
            Partage de données et confidentialité
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Tontine Digital chiffre toutes les données sensibles. Vous gardez le contrôle des partages
            secondaires.
          </p>
        </header>

        <ul className="divide-y divide-border/50">
          {PRIVACY_TOGGLES.map((t) => {
            const Icon = t.icon;
            const value = state[t.id];
            return (
              <li key={t.id} className="flex items-start justify-between gap-3 px-5 py-4 lg:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{t.label}</p>
                      {t.required && (
                        <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                          Obligatoire BCG
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">{t.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={value}
                  aria-disabled={t.required}
                  onClick={() => handleToggle(t.id, t.required)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
                    value ? "bg-success" : "bg-muted",
                    t.required && "cursor-not-allowed opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-card shadow-sm transition",
                      value ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="flex items-center gap-2 border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
          <Cookie className="h-3.5 w-3.5 text-muted-foreground" />
          La gestion fine des cookies est disponible sur le portail web. L'application mobile ne dépose
          aucun cookie tiers.
        </footer>
      </article>

      {/* Data export request */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Droits sur vos données</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Accès, portabilité et suppression selon la réglementation guinéenne
          </p>
        </header>
        <ul className="divide-y divide-border/50">
          <DataRight
            label="Téléchargement complet du dossier"
            description="Pack ZIP signé incluant transactions, KYC, journaux et signatures cryptographiques."
            cta="Préparer l'export"
            onClick={() =>
              toast.success("Export en cours de préparation", {
                description: "Livré sous 72h à votre e-mail vérifié, signé numériquement.",
              })
            }
          />
          <DataRight
            label="Portabilité vers un autre opérateur"
            description="Transfert structuré au format ouvert vers une plateforme tierce de confiance."
            cta="Demander"
            onClick={() =>
              toast("Demande envoyée", {
                description: "Le service conformité valide les conditions de portabilité sous 5 jours ouvrés.",
              })
            }
          />
          <DataRight
            label="Suppression résiduelle"
            description="Effaçage des données non requises par la conservation légale (10 ans pour les opérations financières)."
            cta="Initier"
            onClick={() =>
              toast("Procédure d'effaçage", {
                description: "Vos cycles ouverts doivent être clôturés avant le déclenchement.",
              })
            }
            variant="muted"
          />
        </ul>

        <footer className="flex items-center gap-2 border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Conformité au cadre BCG-2024-018 sur la protection des données dans la finance digitale
        </footer>
      </article>
    </div>
  );
}

function DataRight({
  label,
  description,
  cta,
  onClick,
  variant,
}: {
  label: string;
  description: string;
  cta: string;
  onClick: () => void;
  variant?: "muted";
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-4 text-xs font-semibold transition",
          variant === "muted"
            ? "border border-hairline text-foreground hover:bg-secondary"
            : "bg-primary text-primary-foreground hover:bg-primary-700",
        )}
      >
        {cta}
      </button>
    </li>
  );
}
