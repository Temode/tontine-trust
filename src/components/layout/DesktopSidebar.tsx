import { Clock, Home, Plus, Settings, User, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { currentUser } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Accueil", icon: Home },
  { to: "/groupes", label: "Mes Tontines", icon: Users },
  { to: "/historique", label: "Historique", icon: Clock },
  { to: "/profil", label: "Profil", icon: User },
  { to: "/parametres", label: "Paramètres", icon: Settings },
];

export function DesktopSidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card md:flex">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl gradient-primary text-white shadow-primary">
          <Logo size={22} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Tontine Digital</p>
          <p className="text-[11px] text-muted-foreground">La confiance, digitalisée</p>
        </div>
      </div>

      <Link
        to="/nouveau"
        className="mx-4 mb-4 flex items-center justify-center gap-2 rounded-2xl gradient-primary px-4 py-2.5 text-sm font-semibold text-white shadow-primary transition hover:opacity-95"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Créer une tontine
      </Link>

      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || (item.to === "/dashboard" && pathname === "/");
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-primary-50 text-primary-700"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-accent text-xs font-bold text-accent-foreground">
            {currentUser.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{currentUser.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{currentUser.phone}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
