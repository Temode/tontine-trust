import { Bell } from "lucide-react";
import { currentUser } from "@/lib/mock-data";
import { Logo } from "@/components/brand/Logo";

interface AppHeaderProps {
  notifications?: number;
  title?: string;
  subtitle?: string;
  /** Render extra content below the greeting (e.g. balance card overlap). */
  bottomSlot?: React.ReactNode;
}

export function AppHeader({ notifications = 3, title, subtitle, bottomSlot }: AppHeaderProps) {
  return (
    <header className="gradient-primary relative overflow-hidden text-white">
      {/* Soft glow accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-10">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-accent blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-5xl items-start justify-between px-5 pb-20 pt-8 md:px-8 md:pt-10">
        <div className="flex items-center gap-3">
          <div className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-white/10 backdrop-blur md:flex">
            <Logo size={22} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-white/80">{subtitle ?? "Bienvenue 👋"}</p>
            <h1 className="mt-0.5 text-lg font-bold md:text-xl">{title ?? currentUser.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`${notifications} notifications`}
            className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 backdrop-blur transition hover:bg-white/15"
          >
            <Bell className="h-5 w-5" />
            {notifications > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                {notifications}
              </span>
            )}
          </button>
          <button
            type="button"
            aria-label="Profil"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-accent/30"
          >
            <span className="text-xs font-bold">{currentUser.initials}</span>
          </button>
        </div>
      </div>

      {bottomSlot}
    </header>
  );
}
