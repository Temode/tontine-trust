import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { MobileMoneyOperator, TontineGroup } from "@/lib/types";
import { currentUser } from "@/lib/mock-data";

type Step = "choose" | "processing" | "success";

interface PaymentModalProps {
  group: TontineGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const operators: Array<{
  id: MobileMoneyOperator;
  name: string;
  short: string;
  swatch: string;
  text: string;
  selectedRing: string;
}> = [
  {
    id: "orange",
    name: "Orange Money",
    short: "OM",
    swatch: "bg-orange-500",
    text: "text-white",
    selectedRing: "border-orange-500 bg-orange-50",
  },
  {
    id: "mtn",
    name: "MTN Mobile Money",
    short: "MTN",
    swatch: "bg-yellow-400",
    text: "text-black",
    selectedRing: "border-yellow-500 bg-yellow-50",
  },
];

export function PaymentModal({ group, open, onOpenChange }: PaymentModalProps) {
  const [step, setStep] = useState<Step>("choose");
  const [operator, setOperator] = useState<MobileMoneyOperator>("orange");

  useEffect(() => {
    if (open) {
      setStep("choose");
      setOperator("orange");
    }
  }, [open]);

  const handleConfirm = () => {
    setStep("processing");
    const t1 = window.setTimeout(() => setStep("success"), 1700);
    const t2 = window.setTimeout(() => {
      onOpenChange(false);
      toast.success("Paiement confirmé", {
        description: `Cotisation de ${formatGNF(group.contribution, { withCurrency: true })} enregistrée pour ${group.name}.`,
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
            "md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border",
            "md:data-[state=open]:animate-fade-in",
          )}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-card/95 px-5 py-4 backdrop-blur lg:px-6">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Paiement Mobile Money</p>
              <DialogPrimitive.Title className="font-display text-base font-bold text-foreground lg:text-lg">
                {step === "choose" && "Confirmer la cotisation"}
                {step === "processing" && "Traitement"}
                {step === "success" && "Confirmé"}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="max-h-[calc(92vh-72px)] overflow-y-auto p-5 lg:p-6">
            {step === "choose" && (
              <ChooseStep
                group={group}
                operator={operator}
                onOperatorChange={setOperator}
                onConfirm={handleConfirm}
              />
            )}
            {step === "processing" && <ProcessingStep />}
            {step === "success" && <SuccessStep />}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface ChooseStepProps {
  group: TontineGroup;
  operator: MobileMoneyOperator;
  onOperatorChange: (op: MobileMoneyOperator) => void;
  onConfirm: () => void;
}

function ChooseStep({ group, operator, onOperatorChange, onConfirm }: ChooseStepProps) {
  return (
    <>
      <article className="mb-5 rounded-lg border border-hairline bg-secondary/40 px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Montant à payer</p>
        <p className="mt-1 font-display text-3xl font-bold text-foreground num">
          {formatGNF(group.contribution)}
          <span className="ml-2 text-base font-medium text-muted-foreground">GNF</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{group.name}</p>
      </article>

      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mode de paiement</h4>
      <div className="mb-5 space-y-2" role="radiogroup" aria-label="Mode de paiement">
        {operators.map((op) => {
          const selected = operator === op.id;
          return (
            <button
              key={op.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onOperatorChange(op.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition",
                selected ? op.selectedRing : "border-hairline hover:border-muted-foreground/30",
              )}
            >
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold", op.swatch, op.text)}>
                {op.short}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{op.name}</p>
                <p className="text-xs text-muted-foreground">{currentUser.phone}</p>
              </div>
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2",
                  selected ? "border-primary bg-primary" : "border-hairline",
                )}
              >
                {selected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 rounded-lg border border-hairline px-4 py-3 text-sm">
        <Row label="Cotisation" value={`${formatGNF(group.contribution)} GNF`} />
        <Row label="Frais opérateur" value={<span className="font-medium text-success">Gratuit</span>} />
        <div className="mt-2.5 flex items-center justify-between border-t border-hairline pt-2.5">
          <span className="font-semibold text-foreground">Total</span>
          <span className="font-display font-bold text-foreground num">{formatGNF(group.contribution)} GNF</span>
        </div>
      </div>

      <p className="mb-4 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        Transaction chiffrée et tracée. Reçu numérique généré automatiquement.
      </p>

      <button
        type="button"
        onClick={onConfirm}
        className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary-700"
      >
        Confirmer le paiement
      </button>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between last:mb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function ProcessingStep() {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-primary-100 bg-primary-50">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
      <h3 className="font-display text-base font-bold text-foreground">Traitement en cours</h3>
      <p className="mt-1 text-sm text-muted-foreground">Vérification auprès de votre opérateur Mobile Money.</p>
    </div>
  );
}

function SuccessStep() {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
        <Check className="h-7 w-7 text-success" strokeWidth={2.5} />
      </div>
      <h3 className="font-display text-base font-bold text-foreground">Paiement confirmé</h3>
      <p className="mt-1 text-sm text-muted-foreground">La cotisation a été enregistrée avec succès.</p>
    </div>
  );
}
