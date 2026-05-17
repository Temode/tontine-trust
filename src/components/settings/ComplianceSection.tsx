import { Check, ExternalLink, FileBadge2, Scale, ShieldCheck } from "lucide-react";
import type { LegalDocument } from "@/lib/types";

interface ComplianceSectionProps {
  documents: LegalDocument[];
}

export function ComplianceSection({ documents }: ComplianceSectionProps) {
  return (
    <div className="space-y-6">
      {/* Agreement summary */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">
            Cadre réglementaire et agréments
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Tontine Digital opère sous agrément de la Banque Centrale de Guinée
          </p>
        </header>

        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-3">
          <Tile
            label="Agrément BCG"
            value="BCG-2024-018"
            hint="Émetteur de monnaie électronique"
          />
          <Tile
            label="NIF Tontine Digital"
            value="NIF-GN-100 421"
            hint="Personne morale agréée"
          />
          <Tile
            label="Cabinet d'audit"
            value="KPMG Guinée"
            hint="Revue trimestrielle des registres"
          />
        </div>

        <footer className="flex items-center gap-2 border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
          <Scale className="h-3.5 w-3.5 text-primary" />
          Conformité ISO 27001 · audit externe annuel · médiateur indépendant agréé pour les litiges
        </footer>
      </article>

      {/* Documents accepted */}
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Documents signés</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Versions des textes que vous avez explicitement acceptées
          </p>
        </header>

        <ul className="divide-y divide-border/50">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-4 lg:px-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
                <FileBadge2 className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{d.title}</p>
                  {d.required && (
                    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                      Obligatoire
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">{d.version}</span>
                  <span className="mx-1.5">·</span>
                  Accepté le {d.acceptedOn}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                <Check className="h-3 w-3" strokeWidth={2.5} />
                Signé
              </span>
              <a
                href={d.href}
                onClick={(e) => e.preventDefault()}
                aria-label={`Ouvrir ${d.title}`}
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </li>
          ))}
        </ul>

        <footer className="flex items-center gap-2 border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Toute nouvelle version requiert votre acceptation explicite avant toute opération financière.
        </footer>
      </article>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-card px-5 py-4 lg:px-6">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-base font-bold text-foreground num">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
