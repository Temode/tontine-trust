import { cn } from "@/lib/utils";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "./types";

interface SettingsNavProps {
  current: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
}

export function SettingsNav({ current, onChange }: SettingsNavProps) {
  return (
    <>
      {/* Mobile: select-style chips at top */}
      <nav
        aria-label="Sections paramètres"
        className="flex gap-2 overflow-x-auto rounded-xl border border-hairline bg-card p-2 scrollbar-thin lg:hidden"
      >
        {SETTINGS_SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = s.id === current;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              aria-pressed={active}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </nav>

      {/* Desktop: sticky left rail */}
      <aside className="hidden lg:sticky lg:top-20 lg:block">
        <nav
          aria-label="Sections paramètres"
          className="rounded-xl border border-hairline bg-card p-2"
        >
          <ul className="space-y-0.5">
            {SETTINGS_SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = s.id === current;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onChange(s.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition",
                      active
                        ? "bg-primary-50 text-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-primary"
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                      strokeWidth={1.75}
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          active ? "text-foreground" : "text-foreground",
                        )}
                      >
                        {s.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {s.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Toute modification est notarisée sur le registre Tontine Digital.
        </p>
      </aside>
    </>
  );
}
