import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Loader2, Send, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import { paymentMethods } from "@/lib/mock-data";
import type { DirectoryGroup, MobileMoneyOperator } from "@/lib/types";

type Step = "form" | "submitting" | "submitted";

interface SubscriptionDialogProps {
  group: DirectoryGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriptionDialog({ group, open, onOpenChange }: SubscriptionDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [operator, setOperator] = useState<MobileMoneyOperator>(
    paymentMethods.find((p) => p.primary)?.operator ?? "orange",
  );
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [requestedTurn, setRequestedTurn] = useState<number | "">("");

  useEffect(() => {
    if (open) {
      setStep("form");
      setMessage("");
      setConsent(false);
      setRequestedTurn("");
      setOperator(paymentMethods.find((p) => p.primary)?.operator ?? "orange");
    }
  }, [open]);

  const handleSubmit = () => {
    if (!group || !consent) return;
    setStep("submitting");
    const t1 = window.setTimeout(() => setStep("submitted"), 1500);
    const t2 = window.setTimeout(() => {
      onOpenChange(false);
      toast.success("Candidature envoyée", {
        description: `Votre demande pour rejoindre ${group.name} a été notifiée à l'organisateur.`,
      });
    }, 3200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92vh] w-full overflow-hidden rounded-t-xl border-x border-t border-hairline bg-card shadow-2xl",
            "data-[state=open]:animate-slide-up data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
            "md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-full md:max-w-xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border",
            "md:data-[state=open]:animate-fade-in",
          )}
        >
          {!group ? null : (
            <>
              <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-card/95 px-5 py-4 backdrop-blur lg:px-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Souscription
                  </p>
                  <DialogPrimitive.Title className="font-display text-base font-bold text-foreground lg:text-lg">
                    Rejoindre {group.name}
                  </DialogPrimitive.Title>
                </div>
                <DialogPrimitive.Close
                  aria-label="Fermer"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </DialogPrimitive.Close>
              </header>

              <div className="max-h-[calc(92vh-72px)] overflow-y-auto p-5 lg:p-6">
                {step === "form" && (
                  <FormStep
                    group={group}
                    operator={operator}
                    onOperatorChange={setOperator}
                    message={message}
                    onMessageChange={setMessage}
                    consent={consent}
                    onConsentChange={setConsent}
                    requestedTurn={requestedTurn}
                    onRequestedTurnChange={setRequestedTurn}
                    onSubmit={handleSubmit}
                  />
                )}
                {step === "submitting" && <SubmittingStep />}
                {step === "submitted" && <SubmittedStep group={group} />}
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface FormStepProps {
  group: DirectoryGroup;
  operator: MobileMoneyOperator;
  onOperatorChange: (op: MobileMoneyOperator) => void;
  message: string;
  onMessageChange: (msg: string) => void;
  consent: boolean;
  onConsentChange: (next: boolean) => void;
  requestedTurn: number | "";
  onRequestedTurnChange: (n: number | "") => void;
  onSubmit: () => void;
}

const OPERATOR_VISUAL: Record<MobileMoneyOperator, { label: string; swatch: string; text: string; short: string }> = {
  orange: { label: "Orange Money", swatch: "bg-orange-500", text: "text-white", short: "OM" },
  mtn: { label: "MTN Mobile Money", swatch: "bg-yellow-400", text: "text-black", short: "MTN" },
};

function FormStep({
  group,
  operator,
  onOperatorChange,
  message,
  onMessageChange,
  consent,
  onConsentChange,
  requestedTurn,
  onRequestedTurnChange,
  onSubmit,
}: FormStepProps) {
  const cagnotte = group.contribution * group.members;
  const slots = group.members - group.filled;

  return (
    <>
      {/* Recap */}
      <article className="mb-5 rounded-lg border border-hairline bg-secondary/40 p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Termes du contrat</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <Field label="Cotisation" value={`${formatGNF(group.contribution)} GNF`} />
          <Field label="Fréquence" value={group.frequency} />
          <Field
            label="Cagnotte / tour"
            value={`${formatGNF(cagnotte, { compact: cagnotte >= 1_000_000 })} GNF`}
            valueClass="text-accent-700"
          />
          <Field
            label="Démarrage"
            value={group.startsInDays >= 0 ? formatRelativeDays(group.startsInDays) : "En cours"}
          />
        </dl>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {slots} {slots > 1 ? "places restantes" : "place restante"} sur {group.members} membres ·
          Émetteur : <span className="font-medium text-foreground">{group.organizerName}</span>
        </p>
      </article>

      {/* KYC checks */}
      <section className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pré-requis</p>
        <ul className="mt-2 space-y-1.5">
          <CheckLine label="Identité vérifiée (KYC niveau 2)" />
          <CheckLine label="Numéro Mobile Money confirmé" />
          <CheckLine label={`Score de fiabilité ≥ minimum requis (${Math.max(70, group.meanScore - 10)}%)`} />
        </ul>
      </section>

      {/* KYC checks complete - operator */}
      <section className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Compte de prélèvement
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {paymentMethods.map((m) => {
            const v = OPERATOR_VISUAL[m.operator];
            const active = operator === m.operator;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onOperatorChange(m.operator)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-3 rounded-md border-2 p-3 text-left transition",
                  active ? "border-primary bg-primary-50/40" : "border-hairline hover:bg-secondary/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold",
                    v.swatch,
                    v.text,
                  )}
                >
                  {v.short}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{v.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground num">{m.msisdn}</p>
                </div>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    active ? "border-primary bg-primary" : "border-hairline",
                  )}
                >
                  {active && (
                    <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Optional: Requested turn (if rotation = choice) */}
      {group.rotationOrder === "choice" && (
        <section className="mb-5">
          <label htmlFor="join-turn" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Position souhaitée (facultatif)
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Indiquez votre tour préféré. L'organisateur valide selon la disponibilité.
          </p>
          <input
            id="join-turn"
            type="number"
            min={1}
            max={group.members}
            value={requestedTurn}
            onChange={(e) =>
              onRequestedTurnChange(e.target.value === "" ? "" : Math.max(1, Math.min(group.members, Number(e.target.value))))
            }
            placeholder={`Entre 1 et ${group.members}`}
            className="mt-2 h-10 w-32 rounded-md border border-hairline bg-card px-3 text-base font-semibold text-foreground num focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </section>
      )}

      {/* Optional message */}
      <section className="mb-5">
        <label htmlFor="join-message" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Message à l'organisateur (facultatif)
        </label>
        <textarea
          id="join-message"
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Présentez-vous brièvement et expliquez votre motivation."
          className="mt-2 w-full rounded-md border border-hairline bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
        <p className="mt-1 text-[11px] text-muted-foreground num">{message.length}/280</p>
      </section>

      {/* Consent */}
      <label
        htmlFor="join-consent"
        className="mb-5 flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-secondary/30 p-4"
      >
        <input
          id="join-consent"
          type="checkbox"
          checked={consent}
          onChange={(e) => onConsentChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <div className="text-sm">
          <p className="font-semibold text-foreground">
            J'accepte les termes du contrat et m'engage à honorer chaque cotisation
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            La candidature est notarisée. Aucun débit n'est exécuté tant que l'organisateur n'a pas confirmé
            votre adhésion.
          </p>
        </div>
      </label>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!consent}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold transition",
          consent
            ? "bg-primary text-primary-foreground hover:bg-primary-700"
            : "cursor-not-allowed bg-muted text-muted-foreground",
        )}
      >
        <Send className="h-4 w-4" />
        Soumettre la candidature
      </button>

      <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        Candidature chiffrée · réponse de l'organisateur sous 72h
      </p>
    </>
  );
}

function SubmittingStep() {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-primary-100 bg-primary-50">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
      <h3 className="font-display text-base font-bold text-foreground">Notarisation en cours</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Signature de la candidature et notification de l'organisateur…
      </p>
    </div>
  );
}

function SubmittedStep({ group }: { group: DirectoryGroup }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
        <Check className="h-7 w-7 text-success" strokeWidth={2.5} />
      </div>
      <h3 className="font-display text-base font-bold text-foreground">Candidature transmise</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {group.organizerName} a été notifié(e). Vous serez prévenu de la décision sous 72h.
      </p>
    </div>
  );
}

function Field({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="rounded-md bg-card px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 font-display text-sm font-bold num", valueClass ?? "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}

function CheckLine({ label }: { label: string }) {
  return (
    <li className="inline-flex items-center gap-2 text-sm text-foreground">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      {label}
    </li>
  );
}
