import { Home, Plus, User, Users } from "lucide-react";
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
  { to: "/profil", label: "Profil", icon: User },
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-card/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur lg:hidden"
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
                  className="-mt-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-primary transition active:scale-95"
                >
                  <Icon className="h-5 w-5" strokeWidth={2.25} />
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
                  "flex flex-col items-center gap-0.5 rounded-md px-3 py-1.5 text-[10px] font-medium transition",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
