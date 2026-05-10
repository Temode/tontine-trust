import { Check, FileText, Plus, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { KycDocument, KycDocumentStatus, UserProfile } from "@/lib/types";

const STATUS_VISUAL: Record<KycDocumentStatus, { label: string; className: string }> = {
  verified: { label: "Vérifié", className: "bg-success/10 text-success" },
  pending: { label: "En cours", className: "bg-warning/10 text-warning" },
  rejected: { label: "Rejeté", className: "bg-destructive/10 text-destructive" },
  expired: { label: "Expiré", className: "bg-muted text-muted-foreground" },
};

const KYC_LEVELS: Array<{ level: 1 | 2 | 3; label: string; cap: string; perks: string }> = [
  {
    level: 1,
    label: "Niveau 1 · Identité minimale",
    cap: "Cotisations ≤ 500 000 GNF · 1 groupe à la fois",
    perks: "Numéro Mobile Money vérifié",
  },
  {
    level: 2,
    label: "Niveau 2 · Identité confirmée",
    cap: "Cotisations ≤ 5 000 000 GNF · jusqu'à 10 groupes",
    perks: "CNI/passeport + biométrie + justificatif de domicile",
  },
  {
    level: 3,
    label: "Niveau 3 · Profil professionnel",
    cap: "Aucun plafond · accès aux émissions premium",
    perks: "NIF, attestation fiscale et co-organisateur certifié",
  },
];

interface KycPanelProps {
  profile: UserProfile;
  documents: KycDocument[];
}

export function KycPanel({ profile, documents }: KycPanelProps) {
  const [identity, setIdentity] = useState({
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    occupation: profile.occupation,
    bio: profile.bio,
    city: profile.city,
  });

  const handleSave = () => {
    toast.success("Profil mis à jour", {
      description: "Les modifications sont notarisées sur le registre Tontine Digital.",
    });
  };

  return (
    <div className="space-y-6">
      {/* KYC level overview */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Niveau de vérification</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Trois paliers progressifs régulent les plafonds et l'accès aux émissions
          </p>
        </header>

        <ul className="divide-y divide-border/50">
          {KYC_LEVELS.map((lvl) => {
            const isCurrent = lvl.level === profile.kycLevel;
            const isReached = lvl.level <= profile.kycLevel;
            return (
              <li key={lvl.level} className="px-5 py-4 lg:px-6">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                      isReached
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-hairline bg-card text-muted-foreground",
                    )}
                  >
                    {isReached ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <span className="num">{lvl.level}</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{lvl.label}</p>
                      {isCurrent && (
                        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          Niveau actuel
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{lvl.cap}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{lvl.perks}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </article>

      {/* Documents */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
          <div>
            <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Documents déposés</h2>
            <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
              Pièces officielles archivées chiffrées
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              toast("Module à venir", {
                description: "L'ajout de pièces sera disponible dans la prochaine livraison.",
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </header>

        <ul className="divide-y divide-border/50">
          {documents.map((doc) => {
            const v = STATUS_VISUAL[doc.status];
            return (
              <li key={doc.id} className="flex items-center gap-3 px-5 py-3.5 lg:px-6">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
                  <FileText className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{doc.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {doc.reference && (
                      <>
                        <span className="font-mono">{doc.reference}</span>
                        <span className="mx-1.5">·</span>
                      </>
                    )}
                    Déposé le {doc.uploadedOn}
                    {doc.expiresOn && (
                      <>
                        <span className="mx-1.5">·</span>
                        Expire le {doc.expiresOn}
                      </>
                    )}
                  </p>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", v.className)}>
                  {v.label}
                </span>
              </li>
            );
          })}
        </ul>

        <footer className="flex items-center gap-2 border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Documents chiffrés AES-256 · accessibles uniquement par le service conformité
        </footer>
      </article>

      {/* Personal info form */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Informations personnelles</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Modifiables sous réserve de revérification pour les champs sensibles
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 lg:px-6">
          <FormField id="kyc-name" label="Nom complet" hint="Tel qu'inscrit sur la pièce d'identité.">
            <input
              id="kyc-name"
              type="text"
              value={identity.fullName}
              onChange={(e) => setIdentity({ ...identity, fullName: e.target.value })}
              className="h-10 w-full rounded-md border border-hairline bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </FormField>

          <FormField id="kyc-occ" label="Profession">
            <input
              id="kyc-occ"
              type="text"
              value={identity.occupation}
              onChange={(e) => setIdentity({ ...identity, occupation: e.target.value })}
              className="h-10 w-full rounded-md border border-hairline bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </FormField>

          <FormField id="kyc-phone" label="Numéro Mobile Money" hint="Modification soumise à OTP de confirmation.">
            <input
              id="kyc-phone"
              type="tel"
              value={identity.phone}
              onChange={(e) => setIdentity({ ...identity, phone: e.target.value })}
              className="h-10 w-full rounded-md border border-hairline bg-card px-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </FormField>

          <FormField id="kyc-email" label="E-mail">
            <input
              id="kyc-email"
              type="email"
              value={identity.email}
              onChange={(e) => setIdentity({ ...identity, email: e.target.value })}
              className="h-10 w-full rounded-md border border-hairline bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </FormField>

          <FormField id="kyc-city" label="Ville">
            <input
              id="kyc-city"
              type="text"
              value={identity.city}
              onChange={(e) => setIdentity({ ...identity, city: e.target.value })}
              className="h-10 w-full rounded-md border border-hairline bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </FormField>

          <FormField
            id="kyc-bio"
            label="Présentation"
            hint="Visible sur votre profil public et lors des candidatures."
            full
          >
            <textarea
              id="kyc-bio"
              rows={3}
              maxLength={280}
              value={identity.bio}
              onChange={(e) => setIdentity({ ...identity, bio: e.target.value })}
              className="w-full rounded-md border border-hairline bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
            <p className="mt-1 text-[11px] text-muted-foreground num">{identity.bio.length}/280</p>
          </FormField>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-hairline bg-secondary/30 px-5 py-3 lg:px-6">
          <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Les modifications du nom et du numéro déclenchent une revérification automatique
          </p>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
          >
            Enregistrer
          </button>
        </footer>
      </article>
    </div>
  );
}

function FormField({
  id,
  label,
  hint,
  children,
  full,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn(full && "sm:col-span-2")}>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}
