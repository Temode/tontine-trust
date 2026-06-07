import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";

export type JoinOperator = "orange" | "mtn";

export interface JoinGroupSummary {
  /** Visible group name. */
  name: string;
  /** Optional contribution amount in GNF. */
  contribution?: number;
  /** Optional human-readable frequency (Hebdomadaire / Mensuelle…). */
  frequency?: string;
  /** Optional organiser display name. */
  organizerName?: string;
  /** Optional members capacity (filled / total). */
  filled?: number;
  members?: number;
}

export interface JoinFlowResult {
  operator: JoinOperator;
  message: string | null;
}

export interface JoinFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * "code"      → souscription par code d'invitation (récap minimal).
   * "directory" → souscription depuis l'annuaire public (récap enrichi).
   */
  mode: "code" | "directory";
  /** Group summary for the recap card. Optional when the code's group is unknown. */
  summary?: JoinGroupSummary;
  /** Invitation code, shown when mode === 'code'. */
  code?: string;
  submitting?: boolean;
  /** Loading state for the summary fetch. */
  loadingSummary?: boolean;
  /** Human-readable error if the summary fetch failed. */
  summaryError?: string | null;
  onConfirm: (payload: JoinFlowResult) => void;
}

const OPERATORS: Array<{ id: JoinOperator; label: string; swatch: string; text: string; short: string }> = [
  { id: "orange", label: "Orange Money", swatch: "bg-orange-500", text: "text-white", short: "OM" },
  { id: "mtn", label: "MTN Mobile Money", swatch: "bg-yellow-400", text: "text-black", short: "MTN" },
];

/**
 * Parcours d'adhésion unifié — utilisé à la fois pour le flux « code
 * d'invitation » (CodeEntryHero) et le flux « annuaire public »
 * (SubscriptionDialog). Garantit un niveau d'engagement homogène :
 * récap → opérateur → message → consentement explicite.
 */
export function JoinFlow({
  open,
  onOpenChange,
  mode,
  summary,
  code,
  submitting,
  loadingSummary,
  summaryError,
  onConfirm,
}: JoinFlowProps) {
  const [operator, setOperator] = useState<JoinOperator>("orange");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (open) {
      setOperator("orange");
      setMessage("");
      setConsent(false);
    }
  }, [open]);

  const cagnotte =
    summary?.contribution && summary?.members
      ? summary.contribution * summary.members
      : null;

  const handleSubmit = () => {
    if (!consent || submitting) return;
    onConfirm({ operator, message: message.trim() ? message.trim() : null });
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
            "md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border",
            "md:data-[state=open]:animate-fade-in",
          )}
        >
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-card/95 px-5 py-4 backdrop-blur">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {mode === "code" ? "Confirmation d'adhésion" : "Souscription"}
              </p>
              <DialogPrimitive.Title className="truncate font-display text-base font-bold text-foreground">
                {summary?.name ? `Rejoindre ${summary.name}` : "Rejoindre cette tontine"}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </header>

          <div className="max-h-[calc(92vh-72px)] space-y-5 overflow-y-auto p-5">
            {/* Récap */}
            <section className="rounded-lg border border-hairline bg-secondary/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Termes du contrat
              </p>
              {loadingSummary && !summary ? (
                <div className="mt-3 grid grid-cols-2 gap-3" aria-live="polite">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-md bg-card" />
                  ))}
                </div>
              ) : summaryError && !summary ? (
                <p className="mt-3 text-xs text-destructive" role="alert">
                  Impossible de charger les détails du groupe : {summaryError}
                </p>
              ) : (
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                {summary?.contribution !== undefined && (
                  <Field label="Cotisation" value={`${formatGNF(summary.contribution)} GNF`} />
                )}
                {summary?.frequency && <Field label="Fréquence" value={summary.frequency} />}
                {cagnotte !== null && (
                  <Field
                    label="Cagnotte / tour"
                    value={`${formatGNF(cagnotte, { compact: cagnotte >= 1_000_000 })} GNF`}
                    valueClass="text-accent-700"
                  />
                )}
                {summary?.members && (
                  <Field
                    label="Effectif"
                    value={`${summary.filled ?? 0}/${summary.members} membres`}
                  />
                )}
              </dl>
              )}
              {code && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Code :{" "}
                  <span className="font-mono text-foreground num">{code}</span>
                </p>
              )}
              {summary?.organizerName && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Émetteur :{" "}
                  <span className="font-medium text-foreground">{summary.organizerName}</span>
                </p>
              )}
            </section>

            {/* Opérateur Mobile Money */}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Opérateur de prélèvement
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {OPERATORS.map((op) => {
                  const active = operator === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setOperator(op.id)}
                      aria-pressed={active}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-md border-2 p-3 text-left transition",
                        active
                          ? "border-primary bg-primary-50/40"
                          : "border-hairline hover:bg-secondary/40",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold",
                          op.swatch,
                          op.text,
                        )}
                      >
                        {op.short}
                      </span>
                      <span className="flex-1 truncate text-sm font-semibold text-foreground">
                        {op.label}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border-2",
                          active ? "border-primary bg-primary" : "border-hairline",
                        )}
                      >
                        {active && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                L'opérateur sera utilisé pour vos cotisations. Vous pourrez le changer plus tard.
              </p>
            </section>

            {/* Message à l'organisateur */}
            <section>
              <label
                htmlFor="join-flow-message"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Message à l'organisateur (facultatif)
              </label>
              <textarea
                id="join-flow-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Présentez-vous brièvement (facultatif)."
                className="mt-2 w-full rounded-md border border-hairline bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
              <p className="mt-1 text-[11px] text-muted-foreground num">{message.length}/280</p>
            </section>

            {/* Consentement */}
            <label
              htmlFor="join-flow-consent"
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-secondary/30 p-4"
            >
              <input
                id="join-flow-consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span className="text-sm text-foreground">
                Je confirme vouloir rejoindre ce groupe, accepte les termes du contrat et m'engage à
                honorer chaque cotisation. Aucun débit n'est exécuté avant validation par
                l'organisateur.
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <DialogPrimitive.Close className="inline-flex h-11 min-w-11 items-center rounded-md border border-hairline bg-card px-4 text-sm font-medium text-foreground transition hover:bg-secondary">
                Annuler
              </DialogPrimitive.Close>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!consent || submitting}
                className={cn(
                  "inline-flex h-11 min-w-11 items-center gap-2 rounded-md px-4 text-sm font-semibold transition",
                  consent && !submitting
                    ? "bg-primary text-primary-foreground hover:bg-primary-700"
                    : "cursor-not-allowed bg-muted text-muted-foreground",
                )}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Adhésion en cours…" : "Confirmer mon adhésion"}
              </button>
            </div>

            <p className="inline-flex items-start gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>
                Votre adhésion est horodatée et tracée dans le registre du groupe. La validation finale
                relève de l'organisateur.
              </span>
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Field({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md bg-card px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 font-display text-sm font-bold num", valueClass ?? "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}