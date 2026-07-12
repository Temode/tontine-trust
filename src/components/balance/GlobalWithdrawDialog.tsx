import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatGNF } from "@/lib/format";
import {
  requestUserWithdrawal,
  CHANNEL_LABEL,
  type WithdrawalChannel,
} from "@/lib/api/wallet";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  available: number;
}

const CHANNELS: WithdrawalChannel[] = [
  "mobile_money_om",
  "mobile_money_momo",
  "card",
  "bank_transfer",
];

export function GlobalWithdrawDialog({ open, onOpenChange, available }: Props) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<WithdrawalChannel>("mobile_money_om");
  // Mobile money
  const [phone, setPhone] = useState("");
  const [phoneConfirm, setPhoneConfirm] = useState("");
  // Card
  const [cardholder, setCardholder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  // Bank
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  const parsed = Number.parseInt(amount, 10);
  const amountValid = Number.isFinite(parsed) && parsed > 0 && parsed <= available;

  const details = useMemo<Record<string, string>>(() => {
    if (method === "mobile_money_om" || method === "mobile_money_momo") {
      return { phone: phone.trim(), phone_confirm: phoneConfirm.trim() };
    }
    if (method === "card") {
      return {
        cardholder_name: cardholder.trim(),
        card_number: cardNumber.replace(/\s+/g, ""),
      };
    }
    return {
      bank_name: bankName.trim(),
      bank_code: bankCode.trim(),
      account_number: accountNumber.trim(),
      account_holder: accountHolder.trim(),
    };
  }, [method, phone, phoneConfirm, cardholder, cardNumber, bankName, bankCode, accountNumber, accountHolder]);

  const detailsValid = useMemo(() => {
    if (method === "mobile_money_om" || method === "mobile_money_momo") {
      return (
        details.phone.length >= 8 &&
        details.phone === details.phone_confirm
      );
    }
    if (method === "card") {
      return (
        details.cardholder_name.length > 0 &&
        details.card_number.length >= 12
      );
    }
    return (
      details.bank_name.length > 0 &&
      details.account_number.length >= 5 &&
      details.account_holder.length > 0
    );
  }, [method, details]);

  const phoneMismatch =
    (method === "mobile_money_om" || method === "mobile_money_momo") &&
    phoneConfirm.length > 0 &&
    phone !== phoneConfirm;

  const valid = amountValid && detailsValid;

  const mut = useMutation({
    mutationFn: () =>
      requestUserWithdrawal({ amount: parsed, method, details }),
    onSuccess: () => {
      toast.success("Demande de retrait enregistrée", {
        description: "Vous recevrez un email et un SMS de confirmation.",
      });
      qc.invalidateQueries({ queryKey: ["user-wallet"] });
      qc.invalidateQueries({ queryKey: ["user-withdrawals"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => {
      const msg = e.message.includes("INSUFFICIENT_BALANCE")
        ? "Solde disponible insuffisant."
        : e.message.includes("PHONE_MISMATCH")
        ? "Les deux numéros de téléphone ne correspondent pas."
        : e.message;
      toast.error("Retrait impossible", { description: msg });
    },
  });

  function reset() {
    setAmount("");
    setPhone("");
    setPhoneConfirm("");
    setCardholder("");
    setCardNumber("");
    setBankName("");
    setBankCode("");
    setAccountNumber("");
    setAccountHolder("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold">
            Faire une demande de retrait
          </DialogTitle>
          <DialogDescription>
            Solde disponible :{" "}
            <span className="num font-semibold text-foreground">
              {formatGNF(available, { withCurrency: true })}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Montant */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Montant à retirer (GNF)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={available}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex : 50000"
              className="num mt-1.5 h-11 w-full rounded-md border border-hairline bg-card px-3 text-base font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-1.5 flex gap-1.5">
              {[0.25, 0.5, 1].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(Math.floor(available * p)))}
                  className="rounded-full border border-hairline px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  {p === 1 ? "Tout" : `${p * 100}%`}
                </button>
              ))}
            </div>
            {amount && !amountValid && (
              <p className="mt-1 text-xs text-destructive">
                Le montant doit être compris entre 1 et {formatGNF(available)} GNF.
              </p>
            )}
          </div>

          {/* Méthode */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Moyen de paiement
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as WithdrawalChannel)}
              className="mt-1.5 h-11 w-full rounded-md border border-hairline bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
              ))}
            </select>
          </div>

          {/* Détails conditionnels */}
          {(method === "mobile_money_om" || method === "mobile_money_momo") && (
            <div className="space-y-3 rounded-lg border border-hairline bg-secondary/30 p-3">
              <Field
                label="Numéro de téléphone bénéficiaire"
                value={phone}
                onChange={setPhone}
                placeholder="+224 6XX XX XX XX"
                type="tel"
              />
              <Field
                label="Confirmer le numéro de téléphone"
                value={phoneConfirm}
                onChange={setPhoneConfirm}
                placeholder="Retapez exactement le même numéro"
                type="tel"
              />
              {phoneMismatch && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  Les deux numéros doivent être strictement identiques.
                </p>
              )}
            </div>
          )}

          {method === "card" && (
            <div className="space-y-3 rounded-lg border border-hairline bg-secondary/30 p-3">
              <Field label="Nom du titulaire" value={cardholder} onChange={setCardholder} placeholder="Nom exact figurant sur la carte" />
              <Field label="Numéro de carte" value={cardNumber} onChange={setCardNumber} placeholder="XXXX XXXX XXXX XXXX" inputMode="numeric" />
              <p className="text-[11px] text-muted-foreground">
                Ne renseignez ni CVV ni date d'expiration. L'administrateur vous contactera si besoin.
              </p>
            </div>
          )}

          {method === "bank_transfer" && (
            <div className="space-y-3 rounded-lg border border-hairline bg-secondary/30 p-3">
              <Field label="Nom de la banque" value={bankName} onChange={setBankName} placeholder="Ex : Ecobank Guinée" />
              <Field label="Code banque / Guichet" value={bankCode} onChange={setBankCode} placeholder="Optionnel" />
              <Field label="Numéro de compte / IBAN" value={accountNumber} onChange={setAccountNumber} placeholder="GN…" />
              <Field label="Nom du titulaire du compte" value={accountHolder} onChange={setAccountHolder} placeholder="Nom complet" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-md border border-hairline px-4 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!valid || mut.isPending}
            onClick={() => mut.mutate()}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-700 disabled:opacity-60"
          >
            <Wallet className="h-4 w-4" />
            {mut.isPending ? "Envoi…" : "Valider la demande"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "numeric" | "tel";
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "mt-1 h-10 w-full rounded-md border border-hairline bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
        )}
      />
    </div>
  );
}