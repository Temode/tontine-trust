import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, ShieldCheck, X, ExternalLink, ArrowLeft, Calendar, Wallet, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import { initDjomyPayment, type DjomyMethod } from "@/lib/api/djomy";
import { getMyProfile } from "@/lib/api/profile";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributionId: string;
  groupName: string;
  amount: number;
  turnNumber?: number;
  dueDate?: string;
  beneficiaryName?: string | null;
}

const METHODS: Array<{
  id: DjomyMethod;
  name: string;
  short: string;
  swatch: string;
  text: string;
}> = [
  { id: "OM", name: "Orange Money", short: "OM", swatch: "bg-orange-500", text: "text-white" },
  { id: "MOMO", name: "MTN MoMo", short: "MTN", swatch: "bg-yellow-400", text: "text-black" },
  { id: "CARD", name: "Carte bancaire (Visa/Mastercard)", short: "CB", swatch: "bg-slate-800", text: "text-white" },
];

export function DjomyPaymentModal({ open, onOpenChange, contributionId, groupName, amount, turnNumber, dueDate, beneficiaryName }: Props) {
  const [method, setMethod] = useState<DjomyMethod>("OM");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "recap">("form");
  const sandbox = (import.meta.env.VITE_DJOMY_ENV ?? "sandbox") === "sandbox";

  const { data: profile } = useQuery({ queryKey: ["profile", "me"], queryFn: getMyProfile, enabled: open });

  useEffect(() => {
    if (open) {
      setMethod("OM");
      setLoading(false);
      setStep("form");
      setPhone(profile?.phone_number ?? "");
    }
  }, [open, profile?.phone_number]);

  const phoneOk = method === "CARD" || /\d{8,}/.test(phone.replace(/\D/g, ""));

  const goToRecap = () => {
    if (!phoneOk) {
      toast.error("Numéro requis", { description: "Saisissez le numéro Mobile Money du payeur." });
      return;
    }
    setStep("recap");
  };

  const handleConfirm = async () => {
    if (!phoneOk) {
      toast.error("Numéro requis", { description: "Saisissez le numéro Mobile Money du payeur." });
      return;
    }
    setLoading(true);
    try {
      const res = await initDjomyPayment({
        contributionId,
        method,
        payerPhone: phone || "00224000000000",
      });
      // Mémorise le paymentId pour le retour (PaymentReturn lit ?pid=)
      try { sessionStorage.setItem("lastDjomyPaymentId", res.paymentId); } catch { /* ignore */ }
      // Redirection vers le portail Djomy
      window.location.href = res.redirectUrl;
    } catch (e) {
      setLoading(false);
      const msg = (e as Error).message ?? "Erreur inconnue";
      toast.error("Initialisation échouée", { description: msg, duration: 8000 });
    }
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
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Paiement sécurisé · Djomy {sandbox && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">SANDBOX</span>}
              </p>
              <DialogPrimitive.Title className="font-display text-base font-bold text-foreground lg:text-lg">
                {step === "form" ? "Régler la cotisation" : "Confirmer le paiement"}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="max-h-[calc(92vh-72px)] overflow-y-auto p-5 lg:p-6">
          {step === "form" ? (
            <>
            <article className="mb-5 rounded-lg border border-hairline bg-secondary/40 px-5 py-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Montant à payer</p>
              <p className="mt-1 font-display text-3xl font-bold text-foreground num">
                {formatGNF(amount)}
                <span className="ml-2 text-base font-medium text-muted-foreground">GNF</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{groupName}</p>
            </article>

            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mode de paiement
            </h4>
            <div className="mb-5 space-y-2" role="radiogroup" aria-label="Mode de paiement">
              {METHODS.map((m) => {
                const selected = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "flex w-full min-h-[48px] items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      selected
                        ? "border-primary bg-primary-50/60"
                        : "border-hairline hover:border-muted-foreground/30",
                    )}
                  >
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold", m.swatch, m.text)}>
                      {m.short}
                    </span>
                    <span className="flex-1 text-sm font-medium text-foreground">{m.name}</span>
                    <span
                      className={cn(
                        "h-4 w-4 rounded-full border-2",
                        selected ? "border-primary bg-primary" : "border-hairline",
                      )}
                    />
                  </button>
                );
              })}
            </div>

            {method !== "CARD" && (
              <div className="mb-5">
                <label htmlFor="djomy-phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Numéro {method === "OM" ? "Orange Money" : "MTN MoMo"} du payeur
                </label>
                <input
                  id="djomy-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="6XX XX XX XX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 w-full rounded-lg border border-hairline bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Vous recevrez une demande de confirmation sur ce numéro après la redirection.
                </p>
              </div>
            )}

            <p className="mb-4 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Transaction chiffrée. Vous serez redirigé vers le portail sécurisé Djomy pour finaliser.
            </p>

            <button
              type="button"
              onClick={goToRecap}
              disabled={!phoneOk}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Vérifier le récapitulatif <ExternalLink className="h-4 w-4" />
            </button>
            </>
          ) : (
            <>
              <article className="mb-5 rounded-lg border border-hairline bg-secondary/40 px-5 py-4 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Vous allez payer</p>
                <p className="mt-1 font-display text-4xl font-bold text-foreground num tabular-nums">
                  {formatGNF(amount)}
                  <span className="ml-2 text-base font-medium text-muted-foreground">GNF</span>
                </p>
              </article>
              <dl className="mb-5 divide-y divide-border/60 rounded-lg border border-hairline bg-card">
                <RecapRow icon={<Users className="h-4 w-4" />} label="Tontine" value={groupName} />
                {turnNumber !== undefined && (
                  <RecapRow icon={<Calendar className="h-4 w-4" />} label="Tour" value={`#${turnNumber}`} />
                )}
                {dueDate && (
                  <RecapRow icon={<Calendar className="h-4 w-4" />} label="Échéance" value={new Date(dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} />
                )}
                {beneficiaryName && (
                  <RecapRow icon={<Users className="h-4 w-4" />} label="Bénéficiaire" value={beneficiaryName} />
                )}
                <RecapRow icon={<Wallet className="h-4 w-4" />} label="Mode" value={METHODS.find((m) => m.id === method)?.name ?? method} />
                {method !== "CARD" && phone && (
                  <RecapRow icon={<Wallet className="h-4 w-4" />} label="Numéro" value={phone} />
                )}
              </dl>
              <p className="mb-4 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                En confirmant, vous serez redirigé vers Djomy pour valider le paiement.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  disabled={loading}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-hairline bg-card text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <ArrowLeft className="h-4 w-4" /> Modifier
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="inline-flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Redirection…</>
                  ) : (
                    <>Confirmer et payer <ExternalLink className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            </>
          )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function RecapRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
        {icon}
      </span>
      <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground text-right">{value}</p>
      </div>
    </div>
  );
}