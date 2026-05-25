import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { ReliabilityCard } from "@/components/dashboard/ReliabilityCard";
import { useAuth } from "@/hooks/useAuth";

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Utilisateur";
  const phone = (user?.user_metadata?.phone_number as string | undefined) ?? "—";
  const email = user?.email ?? "—";
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
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
            {initials || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold text-foreground">{fullName}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
            <p className="truncate text-xs text-muted-foreground">{phone}</p>
          </div>
        </article>

        <ReliabilityCard
          score={100}
          onTime={{ current: 0, total: 0 }}
          late={0}
          memberSince="—"
        />

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-hairline bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}