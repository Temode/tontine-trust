import { LogOut, RefreshCw, AlertTriangle, Camera, Loader2, Bell, Shield, BadgeCheck, MailCheck, MailWarning, MessageSquare, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/TopBar";
import { ReliabilityCard } from "@/components/dashboard/ReliabilityCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { useAuth } from "@/hooks/useAuth";
import {
  getMyReliability,
  listMyLateContributions,
  recomputeMyReliability,
} from "@/lib/api/reliability";
import { getMyProfile, uploadAvatar, refreshAvatarSignedUrl, updateMyProfile } from "@/lib/api/profile";
import { getMyKyc, KYC_LEVEL_LABEL } from "@/lib/api/kyc";
import { getMySmsWallet, listMySmsOrders } from "@/lib/api/smsWallet";
import { useEffect, useRef, useState } from "react";
import { formatGNF } from "@/lib/format";
import { PhoneInput, type PhoneInputValue } from "@/components/ui/PhoneInput";
import { DEFAULT_COUNTRY, findCountryByDial, isValidNational, normalizePhone, parseE164, formatPhone } from "@/lib/phone";

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileQ = useQuery({ queryKey: ["profile", "mine"], queryFn: getMyProfile });
  const kycQ = useQuery({ queryKey: ["kyc", "mine"], queryFn: getMyKyc });
  const walletQ = useQuery({ queryKey: ["sms-wallet", "mine"], queryFn: getMySmsWallet });
  const smsOrdersQ = useQuery({ queryKey: ["sms-orders", "mine"], queryFn: () => listMySmsOrders(20) });

  const uploadM = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => {
      toast.success("Photo de profil mise à jour");
      qc.invalidateQueries({ queryKey: ["profile", "mine"] });
    },
    onError: (e: Error) => toast.error("Upload impossible", { description: e.message }),
  });

  const refreshAvatarM = useMutation({
    mutationFn: refreshAvatarSignedUrl,
    onSuccess: (url) => {
      if (url) {
        toast.success("Avatar réactivé");
        qc.invalidateQueries({ queryKey: ["profile", "mine"] });
      } else {
        toast.info("Aucun avatar à réactiver");
      }
    },
    onError: (e: Error) => toast.error("Réactivation impossible", { description: e.message }),
  });

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState<PhoneInputValue>({ dial: DEFAULT_COUNTRY.dial, national: "" });

  useEffect(() => {
    if (!profileQ.data) return;
    setEditName(profileQ.data.full_name ?? "");
    const parsed = parseE164(profileQ.data.phone_number ?? "");
    setEditPhone({ dial: parsed.dial, national: parsed.national });
  }, [profileQ.data]);

  const updateM = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      toast.success("Profil mis à jour");
      qc.invalidateQueries({ queryKey: ["profile", "mine"] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error("Mise à jour impossible", { description: e.message }),
  });

  const handleSaveProfile = () => {
    const name = editName.trim();
    if (name.length < 2) {
      toast.error("Nom requis (au moins 2 caractères)");
      return;
    }
    let phoneE164: string | null = null;
    if (editPhone.national.trim().length > 0) {
      const country = findCountryByDial(editPhone.dial);
      if (!country || !isValidNational(editPhone.national, country)) {
        toast.error("Numéro invalide pour le pays sélectionné.");
        return;
      }
      const norm = normalizePhone(editPhone.national, editPhone.dial);
      if (!norm) {
        toast.error("Numéro invalide.");
        return;
      }
      phoneE164 = `+${norm}`;
    }
    updateM.mutate({ full_name: name, phone_number: phoneE164 });
  };

  const { data: reliability } = useQuery({
    queryKey: ["reliability", "mine"],
    queryFn: getMyReliability,
  });
  const { data: lates = [] } = useQuery({
    queryKey: ["reliability", "lates"],
    queryFn: listMyLateContributions,
  });
  const recompute = useMutation({
    mutationFn: recomputeMyReliability,
    onSuccess: () => {
      toast.success("Score mis à jour");
      qc.invalidateQueries({ queryKey: ["reliability"] });
    },
    onError: (e: Error) => toast.error("Recalcul impossible", { description: e.message }),
  });

  const fullName =
    profileQ.data?.full_name ??
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Utilisateur";
  const phoneRaw = profileQ.data?.phone_number ?? (user?.user_metadata?.phone_number as string | undefined) ?? "";
  const phone = phoneRaw ? formatPhone(phoneRaw) : "—";
  const email = user?.email ?? "—";
  const avatarUrl = profileQ.data?.avatar_url ?? null;
  const initials = fullName
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Vous êtes déconnecté.");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Mon profil"
        subtitle="Vos informations personnelles et votre fiabilité."
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <article className="rounded-xl border border-hairline bg-card p-5">
         <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadM.isPending}
            className="group relative h-16 w-16 overflow-hidden rounded-xl bg-primary text-base font-bold text-primary-foreground transition focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Changer la photo de profil"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-full w-full object-cover"
                onError={() => {
                  if (!refreshAvatarM.isPending) refreshAvatarM.mutate();
                }}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center">{initials || "?"}</span>
            )}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/50 opacity-0 transition group-hover:opacity-100">
              {uploadM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
              ) : (
                <Camera className="h-4 w-4 text-primary-foreground" />
              )}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadM.mutate(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold text-foreground">{fullName}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
            <p className="truncate text-xs text-muted-foreground">{phone}</p>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => refreshAvatarM.mutate()}
                disabled={refreshAvatarM.isPending}
                className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-card px-2 text-[11px] font-semibold text-foreground transition hover:bg-secondary disabled:opacity-60"
              >
                <RefreshCw className={`h-3 w-3 ${refreshAvatarM.isPending ? "animate-spin" : ""}`} />
                Réactiver mon avatar
              </button>
            )}
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-secondary"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
          )}
         </div>

         {editing && (
          <div className="mt-5 space-y-4 border-t border-hairline pt-5">
            <div className="space-y-1.5">
              <label htmlFor="edit-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nom complet
              </label>
              <input
                id="edit-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-11 w-full rounded-md border border-foreground/10 bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Téléphone
              </label>
              <PhoneInput value={editPhone} onChange={setEditPhone} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={updateM.isPending}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {updateM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  if (profileQ.data) {
                    setEditName(profileQ.data.full_name ?? "");
                    const parsed = parseE164(profileQ.data.phone_number ?? "");
                    setEditPhone({ dial: parsed.dial, national: parsed.national });
                  }
                }}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-hairline bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
            </div>
          </div>
         )}
        </article>

        {user?.email && (
          user.email_confirmed_at ? (
            <div className="flex items-center gap-3 rounded-xl border border-hairline bg-card p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary">
                <MailCheck className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-foreground">Email vérifié</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <MailWarning className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900">Email en attente de vérification</p>
                <p className="text-xs text-amber-800">Confirme ton adresse pour sécuriser ton compte.</p>
              </div>
              <Link
                to="/auth/verifier-email"
                state={{ email: user.email }}
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Vérifier
              </Link>
            </div>
          )
        )}

        <ReliabilityCard
          score={reliability?.score ?? 0}
          tier={reliability?.tier ?? "nouveau"}
          onTime={{
            current: reliability?.total_on_time ?? 0,
            total: reliability?.total_paid ?? 0,
          }}
          late={reliability?.total_late ?? 0}
          avgDelay={reliability?.avg_delay_days ?? 0}
          memberSince={
            user?.created_at
              ? new Date(user.created_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
              : "—"
          }
        />

        <button
          type="button"
          onClick={() => recompute.mutate()}
          disabled={recompute.isPending}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-hairline bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${recompute.isPending ? "animate-spin" : ""}`} />
          {recompute.isPending ? "Recalcul…" : "Recalculer mon score"}
        </button>

        {lates.length > 0 && (
          <SectionCard title="Historique des retards" subtitle={`${lates.length} cotisation${lates.length > 1 ? "s" : ""} en retard`} bare>
            <ul className="divide-y divide-border/60">
              {lates.map((l) => (
                <li key={l.contribution_id} className="flex items-center gap-3 px-5 py-3 lg:px-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{l.group_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Tour #{l.turn_number} · échéance {new Date(l.due_date).toLocaleDateString("fr-FR")} ·{" "}
                      <span className="font-semibold text-destructive">+{l.delay_days} j</span>
                    </p>
                  </div>
                  <p className="font-display text-sm font-semibold text-foreground num">
                    {formatGNF(l.amount)} GNF
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        <SectionCard
          title="Forfait SMS"
          subtitle={`Solde : ${walletQ.data?.balance_remaining ?? 0} SMS · ${walletQ.data?.total_purchased ?? 0} achetés · ${walletQ.data?.total_consumed ?? 0} envoyés`}
          bare
        >
          {(smsOrdersQ.data ?? []).length === 0 ? (
            <p className="px-5 py-4 text-xs text-muted-foreground lg:px-6">
              Aucune commande SMS pour l'instant. Rechargez depuis un groupe.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {(smsOrdersQ.data ?? []).map((o) => {
                const tone =
                  o.status === "credited" ? "text-success"
                  : o.status === "failed" || o.status === "cancelled" ? "text-destructive"
                  : "text-muted-foreground";
                const label =
                  o.status === "credited" ? "Créditée"
                  : o.status === "paid" ? "Payée"
                  : o.status === "failed" ? "Échouée"
                  : o.status === "cancelled" ? "Annulée"
                  : "En attente";
                return (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-3 lg:px-6">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {o.qty} SMS · {o.pack_id ?? "pack"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("fr-FR")} · <span className={tone}>{label}</span>
                      </p>
                    </div>
                    <p className="font-display text-sm font-semibold text-foreground num">
                      {formatGNF(o.amount)} GNF
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-hairline bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>

        <Link
          to="/parametres/notifications"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-hairline bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          <Bell className="h-4 w-4" />
          Préférences de notification
        </Link>

        <Link
          to="/profil/confidentialite"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-hairline bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          <Shield className="h-4 w-4" />
          Confidentialité &amp; suppression de compte
        </Link>

        <Link
          to="/profil/kyc"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-hairline bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          <BadgeCheck className="h-4 w-4 text-primary" />
          Vérification d'identité
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {KYC_LEVEL_LABEL[kycQ.data?.kyc_level ?? 0]}
          </span>
        </Link>
      </div>
    </div>
  );
}