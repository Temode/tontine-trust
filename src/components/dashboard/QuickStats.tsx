import { Coins, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Stat {
  icon: LucideIcon;
  value: string;
  label: string;
  tone: "primary" | "accent" | "success";
}

const tones: Record<Stat["tone"], string> = {
  primary: "bg-primary-50 text-primary-700",
  accent: "bg-accent-50 text-accent-600",
  success: "bg-success/10 text-success",
};

interface QuickStatsProps {
  activeGroups: number;
  contributions: number;
  reliabilityScore: number;
}

export function QuickStats({ activeGroups, contributions, reliabilityScore }: QuickStatsProps) {
  const stats: Stat[] = [
    { icon: Users, value: String(activeGroups), label: "Groupes actifs", tone: "primary" },
    { icon: Coins, value: String(contributions), label: "Cotisations", tone: "accent" },
    { icon: ShieldCheck, value: `${reliabilityScore}%`, label: "Score fiabilité", tone: "success" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 md:gap-4">
      {stats.map(({ icon: Icon, value, label, tone }) => (
        <div key={label} className="rounded-2xl bg-card p-3 shadow-soft md:p-4">
          <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]} md:h-10 md:w-10`}>
            <Icon className="h-4 w-4 md:h-5 md:w-5" />
          </div>
          <p className="text-xl font-bold text-foreground num md:text-2xl">{value}</p>
          <p className="text-[10px] text-muted-foreground md:text-xs">{label}</p>
        </div>
      ))}
    </div>
  );
}
