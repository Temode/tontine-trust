import { LogOut, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface TopBarProps {
  title: string;
  subtitle?: string;
  primaryAction?: { label: string; onClick?: () => void; icon?: ReactNode };
  searchPlaceholder?: string;
}

export function TopBar({
  title,
  subtitle,
  primaryAction,
  searchPlaceholder = "Rechercher un groupe, un membre, une transaction...",
}: TopBarProps) {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  // Priorité : super_admin > admin > organisateur > participant
  const ROLE_PRIORITY = ["super_admin", "admin", "organisateur", "participant"] as const;
  const primaryRole =
    ROLE_PRIORITY.find((r) => roles.includes(r as (typeof roles)[number])) ?? roles[0];
  const roleLabel = primaryRole === "super_admin" ? "Super admin" : primaryRole;

  const handleSignOut = async () => {
    await signOut();
    toast.success("Déconnexion réussie");
    navigate("/auth", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-card/85 backdrop-blur">
      <div className="flex items-center justify-between gap-6 px-6 py-4 lg:px-8">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Rechercher"
              placeholder={searchPlaceholder}
              className="h-10 w-72 rounded-lg border border-hairline bg-secondary/60 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <NotificationBell />

          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="hidden h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-primary transition hover:bg-primary-700 sm:flex"
            >
              {primaryAction.icon ?? <Plus className="h-4 w-4" />}
              {primaryAction.label}
            </button>
          )}

          {user && (
            <div className="flex items-center gap-2">
              {primaryRole && (
                <span className="hidden rounded-full border border-hairline bg-secondary/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:inline-flex">
                  {roleLabel}
                </span>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Se déconnecter"
                title="Se déconnecter"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-card text-muted-foreground transition hover:text-foreground"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
