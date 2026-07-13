import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { navSections } from "./navSections";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Utilisateur";
  const phone = (user?.user_metadata?.phone_number as string | undefined) ?? user?.email ?? "";
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

  const ROLE_PRIORITY = ["super_admin", "admin", "organisateur", "participant"] as const;
  const primaryRole =
    ROLE_PRIORITY.find((r) => roles.includes(r as (typeof roles)[number])) ?? roles[0];
  const roleLabel = primaryRole
    ? primaryRole === "super_admin"
      ? "Super admin"
      : primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1)
    : "";

  const isAdmin = roles.includes("super_admin") || roles.includes("admin");

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    toast.success("Déconnexion réussie");
    navigate("/auth", { replace: true });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Ouvrir le menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-card text-muted-foreground transition hover:text-foreground lg:hidden"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[85vw] max-w-[320px] flex-col p-0">
        <SheetHeader className="border-b border-hairline px-5 py-4 text-left">
          <SheetTitle asChild>
            <Link to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-primary">
                <Logo size={22} className="text-primary-foreground" />
              </div>
              <div className="leading-tight">
                <p className="font-display text-base font-bold text-foreground">
                  Tontine <span className="text-primary">Digital</span>
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Infrastructure financière
                </p>
              </div>
            </Link>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.label} className="mb-6 last:mb-0">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.to || (item.to === "/dashboard" && pathname === "/");
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-foreground hover:bg-secondary",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                        <span className="flex-1 truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {isAdmin && (
            <div className="mb-6">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Administration
              </p>
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
              >
                <span className="flex-1 truncate">Espace admin</span>
              </Link>
            </div>
          )}
        </nav>

        <div className="border-t border-hairline p-3">
          <div className="mb-2 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{fullName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{roleLabel || phone}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}