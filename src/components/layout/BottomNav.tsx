import { Bell, Home, MessageCircle, Plus, Users } from "lucide-react";
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
  { to: "/groupes", label: "Tontines", icon: Users },
  { to: "/nouveau", label: "Créer", icon: Plus, isMain: true },
  { to: "/discussions", label: "Messages", icon: MessageCircle },
  { to: "/notifications", label: "Alertes", icon: Bell },
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-card/95 px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.to ||
            (item.to !== "/dashboard" && pathname.startsWith(item.to + "/")) ||
            (item.to === "/dashboard" && pathname === "/");

          if (item.isMain) {
            return (
              <li key={item.to} className="flex justify-center">
                <Link
                  to={item.to}
                  aria-label={item.label}
                  className="-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-primary transition active:scale-95"
                >
                  <Icon className="h-6 w-6" strokeWidth={2.25} />
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
                  "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-medium transition active:scale-95",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
