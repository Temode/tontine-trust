import { Pencil, Send, Shield } from "lucide-react";
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
import { StepWrapper } from "./StepWrapper";

interface StepReviewProps {
  draft: GroupDraft;
  onBack?: () => void;
  onJump: (step: number) => void;
  onSubmit: () => void;
  consent: boolean;
  onConsentChange: (next: boolean) => void;
  index: number;
  total: number;
  submitting?: boolean;
}

export function StepReview({
  draft,
  onBack,
  onJump,
  onSubmit,
  consent,
  onConsentChange,
  index,
  total,
  submitting,
}: StepReviewProps) {
  const derived = deriveFromDraft(draft);
  const coOrganizers = draft.coOrganizerPhones
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const canSubmit = consent && draft.name.trim().length >= 3 && !submitting;

  return (
    <StepWrapper
      index={index}
      total={total}
      title="Émission du groupe"
      description="Relisez les termes une dernière fois. À l'émission, le groupe devient opposable et le code d'invitation est activé."
      canContinue={canSubmit}
      onBack={onBack}
      customActions={
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition",
            canSubmit
              ? "bg-primary text-primary-foreground hover:bg-primary-700"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          <Send className="h-4 w-4" />
          {submitting ? "Émission en cours…" : "Émettre le groupe"}
        </button>
      }
    >
      <div className="space-y-6">
        {/* Identity recap */}
        <ReviewSection
          stepIndex={1}
          title="Identité"
          onEdit={() => onJump(1)}
        >
          <Field label="Nom" value={<span className="font-semibold text-foreground">{draft.name || "—"}</span>} />
          <Field
            label="Description"
            value={draft.description || <span className="text-muted-foreground">Non renseignée</span>}
          />
          <Field label="Catégorie" value={CATEGORY_LABEL[draft.category]} />
        </ReviewSection>

        {/* Financial recap */}
        <ReviewSection stepIndex={2} title="Termes financiers" onEdit={() => onJump(2)}>
          <Field
            label="Cotisation"
            value={
              <span className="font-semibold">
                <span className="num">{formatGNF(draft.contribution)}</span>{" "}
                <span className="text-xs text-muted-foreground">GNF</span>
              </span>
            }
          />
          <Field label="Fréquence" value={draft.frequency} />
          <Field label="Membres" value={<span className="num">{draft.members}</span>} />
          <Field
            label="Cagnotte par tour"
            value={
              <span className="font-semibold text-accent-700">
                <span className="num">{formatGNF(derived.cagnotte)}</span>{" "}
                <span className="text-xs text-accent-600">GNF</span>
              </span>
            }
          />
          <Field label="Durée du cycle" value={derived.cycleLabel} />
        </ReviewSection>

        {/* Rules recap */}
        <ReviewSection stepIndex={3} title="Gouvernance" onEdit={() => onJump(3)}>
          <Field label="Ordre de rotation" value={ROTATION_LABEL[draft.rotationOrder]} />
          <Field
            label="Pénalité de retard"
            value={
              draft.latePenaltyPercent === 0
                ? "Aucune"
                : `${draft.latePenaltyPercent}% après ${draft.latePenaltyAfterDays} jour${draft.latePenaltyAfterDays > 1 ? "s" : ""}`
            }
          />
          <Field label="Politique d'échange" value={SWAP_LABEL[draft.swapPolicy]} />
        </ReviewSection>

        {/* Invitations recap */}
        <ReviewSection stepIndex={4} title="Invitations & accès" onEdit={() => onJump(4)}>
          <Field
            label="Code d'invitation"
            value={<span className="font-mono font-semibold tracking-wider">{draft.inviteCode}</span>}
          />
          <Field label="Visibilité" value={VISIBILITY_LABEL[draft.visibility]} />
          <Field
            label="Co-organisateurs"
            value={
              coOrganizers.length === 0 ? (
                <span className="text-muted-foreground">Aucun</span>
              ) : (
                <span className="num">{coOrganizers.length} numéro{coOrganizers.length > 1 ? "s" : ""}</span>
              )
            }
          />
        </ReviewSection>

        {/* Consent */}
        <label
          htmlFor="cg-consent"
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-secondary/30 p-4"
        >
          <input
            id="cg-consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <div className="text-sm">
            <p className="font-semibold text-foreground">J'émets ce groupe et j'en assume la responsabilité</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Je confirme l'exactitude des termes ci-dessus et accepte qu'ils deviennent opposables aux membres.
              Le registre Tontine Digital horodate cette émission de manière immuable.
            </p>
          </div>
        </label>

        <p className="inline-flex items-start gap-2 text-[11px] text-muted-foreground">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          <span>
            L'émission génère un identifiant cryptographique unique. Les paramètres ne peuvent plus être
            modifiés librement après le démarrage du premier cycle.
          </span>
        </p>
      </div>
    </StepWrapper>
  );
}

interface ReviewSectionProps {
  stepIndex: number;
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}

function ReviewSection({ stepIndex, title, onEdit, children }: ReviewSectionProps) {
  return (
    <section className="rounded-lg border border-hairline">
      <header className="flex items-center justify-between gap-3 border-b border-hairline bg-secondary/30 px-4 py-2.5">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          §{stepIndex} · {title}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md text-[11px] font-medium text-primary transition hover:text-primary-700"
        >
          <Pencil className="h-3 w-3" />
          Modifier
        </button>
      </header>
      <dl className="divide-y divide-border/50">{children}</dl>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}
