import { HelpCircle, LogOut, Plus, Search, User as UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useTour } from "@/components/tour/useTour";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const { start: startTour } = useTour();
  const ROLE_PRIORITY = ["super_admin", "admin", "organisateur", "participant"] as const;
  const primaryRole =
    ROLE_PRIORITY.find((r) => roles.includes(r as (typeof roles)[number])) ?? roles[0];
  const roleLabel =
    primaryRole === "super_admin"
      ? "Super admin"
      : primaryRole
        ? primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1)
        : "";

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "•";

  const handleSignOut = async () => {
    await signOut();
    toast.success("Déconnexion réussie");
    navigate("/auth", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-card">
      <div className="flex h-16 items-center justify-between gap-4 px-6 lg:px-8">
        {/* Titre */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[22px] font-bold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {/* Recherche compacte */}
        <div className="relative hidden lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Rechercher"
            placeholder={searchPlaceholder}
            className="h-9 w-64 rounded-lg border border-hairline bg-secondary/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>

        {/* Cluster utilitaires */}
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            type="button"
            onClick={startTour}
            aria-label="Revoir la visite guidée"
            title="Revoir la visite guidée"
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground sm:flex"
          >
            <HelpCircle className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* CTA primaire — desktop */}
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="hidden h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-700 sm:inline-flex"
          >
            {primaryAction.icon ?? <Plus className="h-4 w-4" />}
            <span className="hidden md:inline">{primaryAction.label}</span>
            <span className="md:hidden">Nouvelle</span>
          </button>
        )}

        {/* CTA primaire — mobile, icône seule */}
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            aria-label={primaryAction.label}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition hover:bg-primary-700 sm:hidden"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}

        {/* Menu avatar */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Compte"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/70 text-[12px] font-semibold uppercase text-foreground transition hover:bg-secondary"
              >
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">
                  {fullName || "Mon compte"}
                </span>
                {primaryRole && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {roleLabel}
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profil")}>
                <UserIcon className="mr-2 h-4 w-4" />
                Mon profil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
