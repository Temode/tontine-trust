import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import {
  CATEGORY_LABEL,
  ROTATION_LABEL,
  SWAP_LABEL,
  VISIBILITY_LABEL,
  deriveFromDraft,
  type GroupDraft,
} from "./types";

interface TermSheetProps {
  draft: GroupDraft;
  /** Issued = wizard finalized, becomes binding. */
  issued?: boolean;
}

export function TermSheet({ draft, issued = false }: TermSheetProps) {
  const derived = deriveFromDraft(draft);
  const coOrganizers = draft.coOrganizerPhones
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <article className="overflow-hidden rounded-xl border border-hairline bg-card text-sm">
      {/* Document header */}
      <header className="border-b border-hairline bg-secondary/40 px-5 py-4 lg:px-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Tontine Digital · Term Sheet
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              issued ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
            )}
          >
            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", issued ? "bg-success" : "bg-warning")} />
            {issued ? "Émis" : "Brouillon"}
          </span>
        </div>
        <p className="mt-3 font-display text-base font-bold leading-tight text-foreground">
          {draft.name || "Groupe sans nom"}
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          {CATEGORY_LABEL[draft.category]} · Cycle {derived.cycleLabel}
        </p>
      </header>

      {/* Sections */}
      <Section title="Émission">
        <Row label="Référence" value={<span className="font-mono">{draft.inviteCode}</span>} />
        <Row label="Catégorie" value={CATEGORY_LABEL[draft.category]} />
        <Row label="Visibilité" value={VISIBILITY_LABEL[draft.visibility]} />
      </Section>

      <Section title="Termes financiers">
        <Row
          label="Cotisation"
          value={
            <>
              <span className="num">{formatGNF(draft.contribution)}</span>
              <span className="ml-1 text-[11px] text-muted-foreground">GNF</span>
            </>
          }
        />
        <Row label="Fréquence" value={draft.frequency} />
        <Row label="Membres" value={<span className="num">{draft.members}</span>} />
        <Row
          label="Cagnotte par tour"
          value={
            <>
              <span className="num font-semibold text-accent-700">{formatGNF(derived.cagnotte)}</span>
              <span className="ml-1 text-[11px] text-muted-foreground">GNF</span>
            </>
          }
        />
        <Row label="Durée du cycle" value={derived.cycleLabel} />
        <Row label="Cycles / an" value={<span className="num">{derived.cyclesPerYear}</span>} mute />
      </Section>

      <Section title="Gouvernance">
        <Row label="Ordre de rotation" value={ROTATION_LABEL[draft.rotationOrder]} />
        <Row
          label="Pénalité de retard"
          value={
            draft.latePenaltyPercent === 0 ? (
              <span className="text-muted-foreground">Aucune</span>
            ) : (
              <>
                <span className="num font-semibold">{draft.latePenaltyPercent}%</span>
                <span className="ml-1 text-[11px] text-muted-foreground">après {draft.latePenaltyAfterDays}j</span>
              </>
            )
          }
        />
        <Row label="Politique d'échange" value={SWAP_LABEL[draft.swapPolicy]} />
      </Section>

      <Section title="Organisation">
        <Row
          label="Co-organisateurs"
          value={
            coOrganizers.length === 0 ? (
              <span className="text-muted-foreground">Aucun</span>
            ) : (
              <span className="num">{coOrganizers.length}</span>
            )
          }
        />
        <Row label="Encaissement le plus tôt" value={derived.yourTurnEarliestLabel} mute />
        <Row label="Encaissement le plus tard" value={derived.yourTurnLatestLabel} mute />
      </Section>

      <footer className="border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
        <p className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          {issued
            ? "Document contraignant · notarisé sur le registre Tontine Digital"
            : "Brouillon non contraignant. Devient opposable à l'émission."}
        </p>
      </footer>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-hairline px-5 py-4 last:border-b-0 lg:px-6">
      <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      <dl className="space-y-2">{children}</dl>
    </section>
  );
}

function Row({ label, value, mute }: { label: string; value: React.ReactNode; mute?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-right text-sm font-medium", mute ? "text-muted-foreground" : "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}
