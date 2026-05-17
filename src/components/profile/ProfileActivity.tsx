import {
  CreditCard,
  Download,
  FileText,
  Fingerprint,
  LogIn,
  type LucideIcon,
  Settings2,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileActivityEntry, ProfileActivityType } from "@/lib/types";

const VISUAL: Record<ProfileActivityType, { Icon: LucideIcon; tone: string }> = {
  login: { Icon: LogIn, tone: "bg-primary-50 text-primary" },
  kyc_update: { Icon: FileText, tone: "bg-success/10 text-success" },
  security_change: { Icon: Fingerprint, tone: "bg-warning/10 text-warning" },
  payment_method: { Icon: CreditCard, tone: "bg-primary-50 text-primary" },
  preferences: { Icon: Settings2, tone: "bg-secondary text-foreground" },
  profile_edit: { Icon: UserCog, tone: "bg-accent-50 text-accent-700" },
  data_export: { Icon: Download, tone: "bg-secondary text-foreground" },
};

interface ProfileActivityProps {
  events: ProfileActivityEntry[];
}

export function ProfileActivity({ events }: ProfileActivityProps) {
  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Journal de profil</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Trace immuable des modifications, connexions et accès au compte
          </p>
        </div>
        <span className="hidden rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex num">
          {events.length} entrées
        </span>
      </header>

      <ol className="relative space-y-3 px-5 py-5 lg:px-6">
        {events.map((event) => {
          const v = VISUAL[event.type];
          const Icon = v.Icon;
          return (
            <li key={event.id} className="flex items-start gap-3 rounded-md border border-hairline px-3 py-3">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", v.tone)}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-foreground">{event.title}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground num">{event.timestamp}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
                <p className="mt-1.5 inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-success" />
                  {event.signature}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
