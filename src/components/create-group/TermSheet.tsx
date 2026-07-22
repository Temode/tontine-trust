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

  const timestamp = new Date().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-3">
    <article className="border border-border border-t-4 border-t-accent bg-card p-6 text-sm lg:p-8">
      {/* Document header */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Term Sheet · Prévisualisation
          </p>
          <h2 className="mt-1 font-serif text-xl font-bold text-foreground">
            {issued ? "Mandat émis" : "Mandat de Constitution"}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {draft.name || <span className="italic">Désignation à compléter</span>}
            {" · "}
            {CATEGORY_LABEL[draft.category]}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
            issued
              ? "border-success/30 bg-success/10 text-success"
              : "border-accent/30 bg-accent-50 text-accent-700",
          )}
        >
          {issued ? "Émis" : "Brouillon"}
        </span>
      </header>

      <div className="space-y-6">
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
      </div>

      <div className="mt-8 border-t border-dashed border-border pt-5">
        <p className="flex items-start gap-2 text-[11px] italic leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          {issued
            ? "Mandat opposable aux membres, horodaté dans le registre Tontine Digital."
            : "Ce document constitue une intention de constitution. Il devient opposable dès l'émission finale."}
        </p>
      </div>
    </article>
      <p className="text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Horodatage système · {timestamp}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 border-b border-border pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
        {title}
      </h3>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

function Row({ label, value, mute }: { label: string; value: React.ReactNode; mute?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-right text-xs font-semibold", mute ? "text-muted-foreground" : "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}
