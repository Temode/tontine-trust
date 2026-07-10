import {
  ChevronDown,
  FileCheck2,
  LayoutDashboard,
  type LucideIcon,
  MessageCircle,
  PiggyBank,
  Sparkles,
  User,
  Users,
  Wallet,
  Target,
  Globe2,
  Briefcase,
  Share2,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { PresencePicker } from "@/components/messages/PresencePicker";

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  dot?: boolean;
  tourId?: string;
}

interface NavSection {
  label: string;
  items: NavEntry[];
}

const sections: NavSection[] = [
  {
    label: "Essentiel",
    items: [
      { to: "/dashboard", label: "Accueil", icon: LayoutDashboard, tourId: "nav-accueil" },
      { to: "/groupes", label: "Mes tontines", icon: Users, tourId: "nav-tontines" },
      { to: "/discussions", label: "Discussions", icon: MessageCircle, tourId: "nav-discussions" },
      { to: "/cotisations", label: "Payer", icon: Wallet, tourId: "nav-payer" },
      { to: "/solde", label: "Mon solde", icon: PiggyBank },
      { to: "/solo", label: "Épargne Solo", icon: Target },
      { to: "/international", label: "International", icon: Globe2 },
      { to: "/coordinateur/commissions", label: "Mes commissions", icon: Briefcase },
      { to: "/affiliation", label: "Affiliation", icon: Share2 },
      { to: "/recus", label: "Historique & reçus", icon: FileCheck2 },
      { to: "/abonnement", label: "Abonnement", icon: Sparkles },
      { to: "/profil", label: "Mon profil", icon: User },
    ],
  },
];

export function DesktopSidebar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Utilisateur";
  const phone = (user?.user_metadata?.phone_number as string | undefined) ?? user?.email ?? "";
  const initials = fullName
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-hairline bg-sidebar lg:flex">
      {/* Brand */}
      <div className="border-b border-hairline px-6 py-5">
        <Link to="/dashboard" className="flex items-center gap-3" data-tour="brand">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-primary">
            <Logo size={22} className="text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-lg font-bold text-foreground">
              Tontine <span className="text-primary">Digital</span>
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Infrastructure financière
            </p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.label} className="mb-7 last:mb-0">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || (item.to === "/dashboard" && pathname === "/");
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      data-tour={item.tourId}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      {active && (
                        <span aria-hidden className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-primary" />
                      )}
                      <Icon className="h-[18px] w-[18px]" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">
                          {item.badge}
                        </span>
                      )}
                      {item.dot && <span className="h-2 w-2 rounded-full bg-destructive" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="border-t border-hairline p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Disponibilité
          </span>
          <PresencePicker />
        </div>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">
            {initials || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{phone}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </aside>
  );
}
