import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Copy, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createGroup } from "@/lib/api/groups";
import { createInvitation } from "@/lib/api/invitations";
import { TopBar } from "@/components/layout/TopBar";
import { StepIdentity } from "@/components/create-group/StepIdentity";
import { StepFinancials } from "@/components/create-group/StepFinancials";
import { StepRules } from "@/components/create-group/StepRules";
import { StepInvitations } from "@/components/create-group/StepInvitations";
import { StepReview } from "@/components/create-group/StepReview";
import { Stepper } from "@/components/create-group/Stepper";
import { TermSheet } from "@/components/create-group/TermSheet";
import {
  DEFAULT_DRAFT,
  STEPS,
  deriveFromDraft,
  type GroupDraft,
} from "@/components/create-group/types";

type WizardState = "drafting" | "submitting" | "issued";

export default function CreateGroup() {
  const [draft, setDraft] = useState<GroupDraft>(DEFAULT_DRAFT);
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<WizardState>("drafting");
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const navigate = useNavigate();

  const totalSteps = STEPS.length;
  const derived = useMemo(() => deriveFromDraft(draft), [draft]);

  const update = (patch: Partial<GroupDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const handleContinue = () => {
    setCompleted((prev) => (prev.includes(step) ? prev : [...prev, step]));
    setStep((s) => Math.min(totalSteps, s + 1));
  };
  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleJump = (target: number) => {
    if (target <= step || completed.includes(target)) setStep(target);
  };

  const handleSubmit = async () => {
    if (state !== "drafting") return;
    setState("submitting");
    setCompleted((prev) => Array.from(new Set([...prev, ...STEPS.map((s) => s.id)])));
    try {
      const { group } = await createGroup(draft);
      // Crée l'invitation initiale avec le code généré dans le wizard.
      try {
        await createInvitation({ groupId: group.id, code: draft.inviteCode });
      } catch {
        // si collision sur le code, en génère un nouveau côté serveur
        await createInvitation({ groupId: group.id });
      }
      setCreatedGroupId(group.id);
      setState("issued");
      toast.success("Groupe émis", {
        description: `${draft.name} a été créé. Le code d'invitation est actif.`,
      });
    } catch (e) {
      setState("drafting");
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error("Création impossible", { description: msg });
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(draft.inviteCode).catch(() => undefined);
    toast.success("Code copié", { description: draft.inviteCode });
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Créer un groupe"
        subtitle="Émettez une nouvelle tontine en cinq étapes structurées."
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <Stepper current={step} onJump={handleJump} completed={completed} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <div>
            {state === "issued" ? (
              <IssuedConfirmation
                draft={draft}
                cagnotte={derived.cagnotte}
                onCopyCode={handleCopyCode}
                groupId={createdGroupId}
              />
            ) : (
              <>
                {step === 1 && (
                  <StepIdentity
                    index={step}
                    total={totalSteps}
                    draft={draft}
                    onChange={update}
                    onContinue={handleContinue}
                  />
                )}
                {step === 2 && (
                  <StepFinancials
                    index={step}
                    total={totalSteps}
                    draft={draft}
                    onChange={update}
                    onBack={handleBack}
                    onContinue={handleContinue}
                  />
                )}
                {step === 3 && (
                  <StepRules
                    index={step}
                    total={totalSteps}
                    draft={draft}
                    onChange={update}
                    onBack={handleBack}
                    onContinue={handleContinue}
                  />
                )}
                {step === 4 && (
                  <StepInvitations
                    index={step}
                    total={totalSteps}
                    draft={draft}
                    onChange={update}
                    onBack={handleBack}
                    onContinue={handleContinue}
                  />
                )}
                {step === 5 && (
                  <StepReview
                    index={step}
                    total={totalSteps}
                    draft={draft}
                    onBack={handleBack}
                    onJump={handleJump}
                    onSubmit={handleSubmit}
                    consent={consent}
                    onConsentChange={setConsent}
                    submitting={state === "submitting"}
                  />
                )}
              </>
            )}
          </div>

          <aside className="xl:sticky xl:top-20 xl:self-start">
            <TermSheet draft={draft} issued={state === "issued"} />
          </aside>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Tontine Digital horodate chaque émission sur un registre immuable. La modification des termes
          devient restreinte une fois le premier cycle démarré.
        </p>
      </div>
    </div>
  );
}

interface IssuedConfirmationProps {
  draft: GroupDraft;
  cagnotte: number;
  onCopyCode: () => void;
  groupId: string | null;
}

function IssuedConfirmation({ draft, cagnotte, onCopyCode, groupId }: IssuedConfirmationProps) {
  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-start gap-4 border-b border-hairline bg-success/5 px-5 py-6 lg:px-7">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-success text-success-foreground">
          <CheckCircle2 className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-success">Émission confirmée</p>
          <h2 className="mt-1 font-display text-xl font-bold text-foreground lg:text-2xl">
            {draft.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {draft.members} membres · cotisation {new Intl.NumberFormat("fr-FR").format(draft.contribution)} GNF · cagnotte {new Intl.NumberFormat("fr-FR").format(cagnotte)} GNF par tour.
          </p>
        </div>
      </header>

      <div className="space-y-5 px-5 py-6 lg:px-7">
        <section className="rounded-lg border border-hairline bg-secondary/30 p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Code d'invitation actif</p>
          <div className="mt-2 flex items-center gap-3">
            <p className="flex-1 truncate font-mono text-2xl font-bold tracking-[0.18em] text-foreground num">
              {draft.inviteCode}
            </p>
            <button
              type="button"
              onClick={onCopyCode}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-card px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
            >
              <Copy className="h-3.5 w-3.5" />
              Copier
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Communiquez ce code à vos futurs membres. Ils pourront rejoindre le groupe depuis l'application.
          </p>
        </section>

        <ol className="space-y-3 text-sm">
          <NextStep n={1} title="Inviter les membres" body="Partagez le code et le lien aux personnes que vous souhaitez voir rejoindre le cycle." />
          <NextStep n={2} title="Confirmer le cycle" body="Une fois le quorum atteint, l'ordre de rotation est déterminé et le premier tour est planifié." />
          <NextStep n={3} title="Lancer la première cotisation" body="Le système notifie chaque membre 48h avant l'échéance et collecte les paiements automatiquement." />
        </ol>

        <p className="inline-flex items-start gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          <span>
            Émission notarisée le jour même · signature cryptographique vérifiable depuis le registre du groupe.
          </span>
        </p>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline bg-secondary/30 px-5 py-4 lg:px-7">
        <Link
          to={groupId ? `/groupes/${groupId}` : "/groupes"}
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-secondary"
        >
          Voir le groupe
        </Link>
        <Link
          to="/inviter"
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700"
        >
          Inviter des membres
          <ArrowRight className="h-4 w-4" />
        </Link>
      </footer>
    </article>
  );
}

function NextStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-hairline text-xs font-semibold text-foreground num">
        {n}
      </span>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}
