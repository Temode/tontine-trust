import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Loader2, X } from "lucide-react";
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
  initials: string;
  swatch: string;
  text: string;
  ring: string;
  surface: string;
}> = [
  {
    id: "orange",
    name: "Orange Money",
    initials: "OM",
    swatch: "bg-orange-500",
    text: "text-white",
    ring: "border-orange-500 bg-orange-50",
    surface: "border-border",
  },
  {
    id: "mtn",
    name: "MTN Mobile Money",
    initials: "MTN",
    swatch: "bg-yellow-400",
    text: "text-black",
    ring: "border-yellow-500 bg-yellow-50",
    surface: "border-border",
  },
];

export function PaymentModal({ group, open, onOpenChange }: PaymentModalProps) {
  const [step, setStep] = useState<Step>("choose");
  const [operator, setOperator] = useState<MobileMoneyOperator>("orange");

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("choose");
      setOperator("orange");
    }
  }, [open]);

  const handleConfirm = () => {
    setStep("processing");
    const t1 = window.setTimeout(() => setStep("success"), 1800);
    const t2 = window.setTimeout(() => {
      onOpenChange(false);
      toast.success("Paiement confirmé", {
        description: `Votre cotisation de ${formatGNF(group.contribution, { withCurrency: true })} a été enregistrée.`,
      });
    }, 3300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92vh] w-full overflow-hidden rounded-t-3xl bg-card shadow-2xl",
            "data-[state=open]:animate-slide-up data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
            "md:left-1/2 md:right-auto md:top-1/2 md:bottom-auto md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl",
            "md:data-[state=open]:animate-fade-in",
          )}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
            <DialogPrimitive.Title className="text-base font-bold text-foreground">
              {step === "choose" && "Payer ma cotisation"}
              {step === "processing" && "Traitement..."}
              {step === "success" && "Confirmation"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/70"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="max-h-[calc(92vh-64px)] overflow-y-auto p-5">
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
      <div className="mb-5 rounded-2xl bg-primary-50 p-5 text-center">
        <p className="text-xs font-medium text-primary-700">Montant à payer</p>
        <p className="mt-1 text-3xl font-bold text-foreground num">
          <span className="text-primary-700">{formatGNF(group.contribution)}</span>
          <span className="ml-2 text-base font-medium text-muted-foreground">GNF</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{group.name}</p>
      </div>

      <h4 className="mb-3 text-sm font-semibold text-foreground">Choisir le mode de paiement</h4>
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
                "flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition",
                selected ? op.ring : "border-border hover:border-muted-foreground/40",
              )}
            >
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold", op.swatch, op.text)}>
                {op.initials}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{op.name}</p>
                <p className="text-xs text-muted-foreground">{currentUser.phone}</p>
              </div>
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2",
                  selected ? "border-primary bg-primary" : "border-border",
                )}
              >
                {selected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-5 rounded-2xl bg-muted p-4 text-sm">
        <Row label="Cotisation" value={`${formatGNF(group.contribution)} GNF`} />
        <Row label="Frais" value={<span className="font-semibold text-success">Gratuit</span>} />
        <div className="mt-2 flex justify-between border-t border-border/60 pt-2">
          <span className="font-semibold text-foreground">Total</span>
          <span className="font-bold text-primary-700 num">{formatGNF(group.contribution)} GNF</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onConfirm}
        className="h-12 w-full rounded-2xl gradient-primary text-sm font-semibold text-white shadow-primary transition hover:opacity-95 active:scale-[0.98]"
      >
        Confirmer le paiement
      </button>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="mb-2 flex justify-between last:mb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function ProcessingStep() {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-700" />
      </div>
      <h3 className="text-lg font-bold text-foreground">Traitement en cours...</h3>
      <p className="mt-1 text-sm text-muted-foreground">Vérification auprès de votre opérateur Mobile Money.</p>
    </div>
  );
}

function SuccessStep() {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 animate-bounce-once items-center justify-center rounded-full bg-success/10">
        <Check className="h-8 w-8 text-success" strokeWidth={3} />
      </div>
      <h3 className="text-lg font-bold text-foreground">Paiement réussi !</h3>
      <p className="mt-1 text-sm text-muted-foreground">Votre cotisation a été enregistrée avec succès.</p>
    </div>
  );
}
