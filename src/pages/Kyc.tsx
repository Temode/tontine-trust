import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Loader2, Phone, ShieldCheck, Upload, FileText, Clock, XCircle, CheckCircle2 } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getMyKyc, listMyKycDocuments, listKycLevels, sendPhoneOtp, verifyPhoneOtp,
  uploadKycFile, submitKycDocument, DOC_TYPE_LABEL,
} from "@/lib/api/kyc";
import { getMyProfile } from "@/lib/api/profile";
import { formatGNF } from "@/lib/format";

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  verified: { label: "Validé", cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  rejected: { label: "Refusé", cls: "bg-rose-100 text-rose-800 border-rose-300", icon: XCircle },
};

export default function Kyc() {
  const qc = useQueryClient();
  const kycQ = useQuery({ queryKey: ["kyc", "mine"], queryFn: getMyKyc });
  const docsQ = useQuery({ queryKey: ["kyc", "docs"], queryFn: listMyKycDocuments });
  const levelsQ = useQuery({ queryKey: ["kyc", "levels"], queryFn: listKycLevels });
  const profileQ = useQuery({ queryKey: ["profile", "mine"], queryFn: getMyProfile });

  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [docType, setDocType] = useState<string>("nina");
  const [docNumber, setDocNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const sendOtp = useMutation({
    mutationFn: () => sendPhoneOtp(phone || profileQ.data?.phone_number || ""),
    onSuccess: () => { setOtpSent(true); toast.success("Code envoyé par SMS"); },
    onError: (e: Error) => toast.error("Envoi impossible", { description: e.message }),
  });
  const verifyOtp = useMutation({
    mutationFn: () => verifyPhoneOtp(code),
    onSuccess: () => {
      toast.success("Téléphone vérifié — Palier 1 débloqué");
      setOtpSent(false); setCode("");
      qc.invalidateQueries({ queryKey: ["kyc"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error("Vérification échouée", { description: e.message }),
  });

  const submitDoc = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Aucun fichier sélectionné");
      const path = await uploadKycFile(file, docType);
      return submitKycDocument(docType, path, docNumber || null);
    },
    onSuccess: () => {
      toast.success("Pièce envoyée — décision sous 48h");
      setFile(null); setDocNumber("");
      qc.invalidateQueries({ queryKey: ["kyc"] });
    },
    onError: (e: Error) => toast.error("Envoi impossible", { description: e.message }),
  });

  const level = kycQ.data?.kyc_level ?? 0;
  const phoneOk = !!kycQ.data?.phone_verified_at;
  const idOk = level >= 2;

  return (
    <div className="animate-fade-in">
      <TopBar title="Vérification d'identité" subtitle="Débloquez les tontines à fort montant." />
      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8 max-w-3xl">
        <Link to="/profil" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour au profil
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Mon palier de confiance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(levelsQ.data ?? []).map((l) => {
                const active = level === l.level;
                const passed = level > l.level;
                return (
                  <div key={l.level}
                    className={`flex-1 min-w-[180px] rounded-lg border-2 p-3 transition ${
                      active ? "border-primary bg-primary/10" : passed ? "border-emerald-400 bg-emerald-50" : "border-border bg-card"
                    }`}>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Palier {l.level} — {l.label}</p>
                      {passed && <BadgeCheck className="h-4 w-4 text-emerald-600" />}
                      {active && <Badge variant="default">Actuel</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{l.description}</p>
                    {l.level > 0 && (
                      <p className="mt-2 text-xs">
                        Plafond cotisation : {l.max_contribution_amount >= 9_000_000_000_000_000_000
                          ? "illimité" : `${formatGNF(l.max_contribution_amount)} GNF`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className={phoneOk ? "border-emerald-300" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" /> Étape 1 — Téléphone {phoneOk && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {phoneOk ? (
              <p className="text-sm text-emerald-700">
                Numéro vérifié le {new Date(kycQ.data!.phone_verified_at!).toLocaleDateString("fr-FR")}.
              </p>
            ) : (
              <>
                <Label htmlFor="phone">Votre numéro guinéen</Label>
                <div className="flex gap-2">
                  <Input id="phone" type="tel" placeholder="6XXXXXXXX ou +224..." value={phone}
                    onChange={(e) => setPhone(e.target.value)} disabled={otpSent}
                    defaultValue={profileQ.data?.phone_number ?? ""} />
                  <Button onClick={() => sendOtp.mutate()} disabled={sendOtp.isPending || otpSent}>
                    {sendOtp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer le code"}
                  </Button>
                </div>
                {otpSent && (
                  <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                    <Label htmlFor="code">Code à 6 chiffres reçu par SMS</Label>
                    <div className="flex gap-2">
                      <Input id="code" inputMode="numeric" maxLength={6} value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
                      <Button onClick={() => verifyOtp.mutate()} disabled={verifyOtp.isPending || code.length !== 6}>
                        {verifyOtp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Valider"}
                      </Button>
                    </div>
                    <button type="button" onClick={() => { setOtpSent(false); setCode(""); }}
                      className="text-xs text-muted-foreground underline">
                      Saisir un autre numéro
                    </button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className={idOk ? "border-emerald-300" : phoneOk ? "" : "opacity-60"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Étape 2 — Pièce d'identité {idOk && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!phoneOk && (
              <p className="text-sm text-muted-foreground">Vérifiez d'abord votre téléphone.</p>
            )}
            {idOk && (
              <p className="text-sm text-emerald-700">Identité validée. Aucune limite de montant.</p>
            )}
            {phoneOk && !idOk && (
              <>
                <div>
                  <Label>Type de pièce</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DOC_TYPE_LABEL).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="docnum">Numéro du document (facultatif)</Label>
                  <Input id="docnum" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="file">Photo recto (PDF, JPG, PNG, max 5 Mo)</Label>
                  <Input id="file" type="file" accept="image/*,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
                <Button onClick={() => submitDoc.mutate()}
                  disabled={submitDoc.isPending || !file}>
                  {submitDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Soumettre pour validation
                </Button>
              </>
            )}

            {(docsQ.data ?? []).length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Historique</p>
                {docsQ.data!.map((d) => {
                  const b = STATUS_BADGE[d.status];
                  const Icon = b.icon;
                  return (
                    <div key={d.id} className="flex items-center justify-between rounded border border-hairline p-2 text-sm">
                      <div>
                        <p className="font-medium">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</p>
                        <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString("fr-FR")}</p>
                        {d.review_note && <p className="text-xs text-rose-700">Motif : {d.review_note}</p>}
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${b.cls}`}>
                        <Icon className="h-3 w-3" /> {b.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}