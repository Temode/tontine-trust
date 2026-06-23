import { LogOut, RefreshCw, AlertTriangle, Camera, Loader2, Bell, Shield, BadgeCheck } from "lucide-react";
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
import { getMyProfile, uploadAvatar, refreshAvatarSignedUrl } from "@/lib/api/profile";
import { getMyKyc, KYC_LEVEL_LABEL } from "@/lib/api/kyc";
import { useRef } from "react";
import { formatGNF } from "@/lib/format";

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileQ = useQuery({ queryKey: ["profile", "mine"], queryFn: getMyProfile });
  const kycQ = useQuery({ queryKey: ["kyc", "mine"], queryFn: getMyKyc });

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
  const phone = profileQ.data?.phone_number ?? (user?.user_metadata?.phone_number as string | undefined) ?? "—";
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
        <article className="flex items-center gap-4 rounded-xl border border-hairline bg-card p-5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadM.isPending}
            className="group relative h-16 w-16 overflow-hidden rounded-xl bg-primary text-base font-bold text-primary-foreground transition focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Changer la photo de profil"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
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
        </article>

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