import { AlertTriangle, Check, Clock, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemberStatusEntry } from "@/lib/mock-data";

const statusVisuals: Record<MemberStatusEntry["status"], {
  wrap: string;
  avatar: string;
  text: string;
  label: string;
  Icon: LucideIcon;
}> = {
  paid: {
    wrap: "bg-success/[0.06] border-success/15",
    avatar: "bg-success",
    text: "text-success",
    label: "Payé",
    Icon: Check,
  },
  pending: {
    wrap: "bg-warning/[0.06] border-warning/15",
    avatar: "bg-warning",
    text: "text-warning",
    label: "En attente",
    Icon: Clock,
  },
  late: {
    wrap: "bg-destructive/[0.06] border-destructive/15",
    avatar: "bg-destructive",
    text: "text-destructive",
    label: "Retard",
    Icon: AlertTriangle,
  },
  beneficiary: {
    wrap: "bg-accent-50 border-accent-300",
    avatar: "bg-accent-600",
    text: "text-accent-700",
    label: "Bénéficiaire",
    Icon: Sparkles,
  },
};

export function MemberStatusGrid({ entries }: { entries: MemberStatusEntry[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      {entries.map((entry) => {
        const v = statusVisuals[entry.status];
        const { Icon } = v;
        return (
          <div
            key={entry.id}
            className={cn(
              "rounded-lg border p-3 text-center transition-colors",
              v.wrap,
              entry.isYou && "ring-2 ring-accent-300 ring-offset-2 ring-offset-card",
            )}
          >
            <div
              className={cn(
                "mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-primary-foreground",
                v.avatar,
              )}
            >
              {entry.initials}
            </div>
            <p className="truncate text-xs font-medium text-foreground">{entry.name}</p>
            <p className={cn("mt-0.5 inline-flex items-center justify-center gap-1 text-[10px] font-medium", v.text)}>
              <Icon className="h-3 w-3" strokeWidth={2.25} />
              {v.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
