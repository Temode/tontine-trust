import { Clock, Home, Plus, User, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  isMain?: boolean;
};

const items: NavItem[] = [
  { to: "/dashboard", label: "Accueil", icon: Home },
  { to: "/groupes", label: "Groupes", icon: Users },
  { to: "/nouveau", label: "Créer", icon: Plus, isMain: true },
  { to: "/historique", label: "Historique", icon: Clock },
  { to: "/profil", label: "Profil", icon: User },
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-end justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || (item.to === "/dashboard" && pathname === "/");

          if (item.isMain) {
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-label={item.label}
                  className="-mt-6 flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary text-white shadow-primary transition active:scale-95"
                >
                  <Icon className="h-6 w-6" strokeWidth={2.5} />
                </Link>
              </li>
            );
          }

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
