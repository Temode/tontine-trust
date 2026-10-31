import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getActiveContract,
  getMyContractSignature,
  sha256Hex,
  signContract,
} from "@/lib/api/contracts";

interface ContractSignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  defaultPhone?: string | null;
}

type Step = "review" | "otp_sent" | "signing" | "done";

/**
 * Dialog d'adhésion : affiche le contrat, demande OTP SMS, enregistre la signature
 * (hash SHA-256 du texte + référence OTP).
 */
export function ContractSignDialog({ open, onOpenChange, groupId, defaultPhone }: ContractSignDialogProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("review");
  const [accepted, setAccepted] = useState(false);
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [code, setCode] = useState("");
  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const contractQ = useQuery({
    queryKey: ["active-contract", groupId],
    queryFn: () => getActiveContract(groupId),
    enabled: open && !!groupId,
  });
  const sigQ = useQuery({
    queryKey: ["my-contract-sig", contractQ.data?.contract_id],
    queryFn: () => getMyContractSignature(contractQ.data!.contract_id),
    enabled: !!contractQ.data?.contract_id,
  });

  useEffect(() => { if (sigQ.data) setStep("done"); }, [sigQ.data]);

  const contract = contractQ.data;
  const hashPromise = useMemo(
    () => (contract ? sha256Hex(contract.body_md) : Promise.resolve("")),
    [contract],
  );

  const sendOtp = async () => {
    if (!phone.trim()) return toast.error("Numéro de téléphone requis");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("kyc-send-otp", { body: { phone: phone.trim() } });
      if (error || (data as { error?: string })?.error) throw new Error((data as { error?: string })?.error ?? error?.message ?? "OTP_FAILED");
      // Récupère le dernier challenge OTP de l'utilisateur pour le réutiliser à la signature
      const { data: u } = await supabase.auth.getUser();
      const { data: chal } = await supabase
        .from("phone_otp_challenges")
        .select("id")
        .eq("user_id", u.user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (chal?.id) setOtpChallengeId(chal.id);
      setStep("otp_sent");
      toast.success("Code envoyé par SMS");
    } catch (e) { toast.error("Envoi OTP échoué", { description: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const verifyAndSign = async () => {
    if (!/^\d{6}$/.test(code)) return toast.error("Code à 6 chiffres requis");
    if (!otpChallengeId) return toast.error("Session OTP introuvable");
    setBusy(true); setStep("signing");
    try {
      const { data: vData, error: vErr } = await supabase.functions.invoke("kyc-verify-otp", { body: { code } });
      if (vErr || (vData as { error?: string })?.error) throw new Error((vData as { error?: string })?.error ?? vErr?.message ?? "OTP_INVALID");
      const hash = await hashPromise;
      await signContract({ groupId, otpChallengeId, hashSha256: hash });
      toast.success("Contrat signé", { description: "Votre signature électronique a été enregistrée." });
      qc.invalidateQueries({ queryKey: ["my-contract-sig"] });
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      setStep("done");
    } catch (e) {
      toast.error("Signature impossible", { description: (e as Error).message });
      setStep("otp_sent");
    } finally { setBusy(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-display text-lg font-bold">Contrat numérique de solidarité</h2>
            <p className="text-xs text-muted-foreground">
              {contract ? `Version ${contract.version}` : "Chargement…"}
              {contract?.is_default && " · modèle plateforme"}
            </p>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {contractQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : !contract ? (
            <p className="text-sm text-destructive">Aucun contrat actif trouvé.</p>
          ) : step === "done" || sigQ.data ? (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Contrat déjà signé.</p>
              {sigQ.data && (
                <p className="mt-1 text-xs">Signé le {new Date(sigQ.data.signed_at).toLocaleString("fr-FR")} — empreinte {sigQ.data.hash_sha256.slice(0, 16)}…</p>
              )}
            </div>
          ) : (
            <>
              <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-3 text-xs leading-relaxed text-foreground">{contract.body_md}</pre>
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4" />
                <span>J'ai lu et j'accepte les termes du contrat ci-dessus.</span>
              </label>

              {step === "review" && (
                <div className="mt-4 space-y-2">
                  <label className="block text-xs font-semibold uppercase text-muted-foreground">Numéro de téléphone (OTP)</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+224 6XX XX XX XX"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" />
                  <button type="button" disabled={!accepted || busy} onClick={sendOtp}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Recevoir le code SMS
                  </button>
                </div>
              )}

              {(step === "otp_sent" || step === "signing") && (
                <div className="mt-4 space-y-2">
                  <label className="block text-xs font-semibold uppercase text-muted-foreground">Code SMS à 6 chiffres</label>
                  <input type="text" inputMode="numeric" maxLength={6} value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="h-12 w-full rounded-md border-2 border-primary bg-background px-3 text-center text-2xl font-bold tracking-[0.5em]" />
                  <button type="button" disabled={busy || code.length !== 6} onClick={verifyAndSign}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Signer le contrat
                  </button>
                  <button type="button" onClick={sendOtp} disabled={busy} className="text-xs text-muted-foreground underline">
                    Renvoyer un code
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}