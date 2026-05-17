import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  CheckCircle2,
  Crown,
  type LucideIcon,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LedgerEvent, LedgerEventType } from "@/lib/types";

const visuals: Record<LedgerEventType, { icon: LucideIcon; tone: string }> = {
  group_joined: { icon: UserPlus, tone: "bg-primary-50 text-primary" },
  group_created: { icon: Sparkles, tone: "bg-primary-50 text-primary" },
  rules_updated: { icon: Settings2, tone: "bg-secondary text-foreground" },
  member_added: { icon: UserPlus, tone: "bg-success/10 text-success" },
  member_removed: { icon: UserMinus, tone: "bg-destructive/10 text-destructive" },
  swap_proposed: { icon: ArrowRightLeft, tone: "bg-warning/10 text-warning" },
  swap_accepted: { icon: CheckCircle2, tone: "bg-success/10 text-success" },
  swap_declined: { icon: ShieldAlert, tone: "bg-destructive/10 text-destructive" },
  beneficiary_confirmed: { icon: Crown, tone: "bg-accent-50 text-accent-700" },
  payment_made: { icon: ArrowUpRight, tone: "bg-secondary text-foreground" },
  cagnotte_received: { icon: ArrowDownLeft, tone: "bg-success/10 text-success" },
  penalty_applied: { icon: ShieldAlert, tone: "bg-destructive/10 text-destructive" },
  cycle_started: { icon: Users, tone: "bg-primary-50 text-primary" },
  cycle_completed: { icon: CheckCircle2, tone: "bg-muted text-muted-foreground" },
  kyc_verified: { icon: ShieldCheck, tone: "bg-success/10 text-success" },
};

type Filter = "all" | "financial" | "governance" | "lifecycle";

const FINANCIAL: LedgerEventType[] = ["payment_made", "cagnotte_received", "penalty_applied"];
const GOVERNANCE: LedgerEventType[] = ["rules_updated", "swap_proposed", "swap_accepted", "swap_declined", "beneficiary_confirmed"];
const LIFECYCLE: LedgerEventType[] = ["group_joined", "group_created", "member_added", "member_removed", "cycle_started", "cycle_completed", "kyc_verified"];

const filterOptions: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "financial", label: "Financier" },
  { id: "governance", label: "Gouvernance" },
  { id: "lifecycle", label: "Cycle de vie" },
];

export function ActivityJournal({ events }: { events: LedgerEvent[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    if (filter === "all") return events;
    const set =
      filter === "financial" ? new Set(FINANCIAL) : filter === "governance" ? new Set(GOVERNANCE) : new Set(LIFECYCLE);
    return events.filter((e) => set.has(e.type));
  }, [events, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, LedgerEvent[]>();
    for (const e of visible) {
      // Group by display month/year extracted from the timestamp string ("28 Déc 2024 · 14:32" → "Déc 2024").
      const key = e.timestamp.split(" · ")[0]?.split(" ").slice(1).join(" ") ?? "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    for (const list of map.values()) list.sort((a, b) => a.daysFromToday - b.daysFromToday);
    return Array.from(map.entries());
  }, [visible]);

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex flex-col gap-3 border-b border-hairline px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Journal d'activité</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Trace immuable des événements financiers et de gouvernance
          </p>
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-md bg-secondary/60 p-0.5">
          {filterOptions.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition",
                filter === f.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {visible.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-muted-foreground">
          Aucun événement pour ce filtre.
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {grouped.map(([month, list]) => (
            <section key={month} className="px-5 py-4 lg:px-6">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{month}</h3>
              <ol className="relative space-y-3 pl-5 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-border/60">
                {list.map((event) => (
                  <ActivityRow key={event.id} event={event} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}

function ActivityRow({ event }: { event: LedgerEvent }) {
  const v = visuals[event.type];
  const Icon = v.icon;

  return (
    <li className="relative">
      <span
        aria-hidden
        className={cn(
          "absolute -left-[18px] top-1 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-card",
          v.tone,
        )}
      >
        <Icon className="h-3 w-3" strokeWidth={2.25} />
      </span>

      <div className="rounded-md border border-hairline bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-foreground">{event.title}</p>
          <span className="shrink-0 text-[11px] text-muted-foreground num">{event.timestamp}</span>
        </div>
        {event.detail && <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {event.groupName && (
            <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-medium uppercase tracking-wider">
              {event.groupName}
            </span>
          )}
          <span>
            par <span className="font-medium text-foreground">{event.actor}</span>
          </span>
          <span aria-hidden className="text-border">·</span>
          <span className="inline-flex items-center gap-1 font-mono">
            <ShieldCheck className="h-3 w-3 text-success" />
            {event.signature}
          </span>
        </div>
      </div>
    </li>
  );
}
