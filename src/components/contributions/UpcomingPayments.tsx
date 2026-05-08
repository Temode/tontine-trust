import { CalendarClock, Clock, Wallet, Zap } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import type { UpcomingContribution } from "@/lib/mock-data";

const BUCKETS: Array<{
  id: UpcomingContribution["bucket"];
  label: string;
  hint: string;
}> = [
  { id: "overdue", label: "En retard", hint: "Action immédiate" },
  { id: "this-week", label: "Cette semaine", hint: "≤ 7 jours" },
  { id: "this-month", label: "Ce mois", hint: "8 – 30 jours" },
  { id: "later", label: "À venir", hint: "> 30 jours" },
];

interface UpcomingPaymentsProps {
  items: UpcomingContribution[];
  onPay?: (item: UpcomingContribution) => void;
}

export function UpcomingPayments({ items, onPay }: UpcomingPaymentsProps) {
  const grouped = useMemo(() => {
    const map = new Map<UpcomingContribution["bucket"], UpcomingContribution[]>();
    for (const b of BUCKETS) map.set(b.id, []);
    for (const item of items) map.get(item.bucket)?.push(item);
    return map;
  }, [items]);

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between border-b border-hairline px-5 py-4 lg:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Échéancier</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Toutes vos cotisations à venir, classées par urgence.
          </p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success sm:inline-flex">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" />
          Synchronisé
        </span>
      </header>

      <div className="divide-y divide-border/50">
        {BUCKETS.map((bucket) => {
          const list = grouped.get(bucket.id) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={bucket.id} aria-label={bucket.label} className="px-5 py-4 lg:px-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {bucket.label}
                  <span className="ml-2 text-muted-foreground/60">· {bucket.hint}</span>
                </h3>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-foreground num">
                  {list.length}
                </span>
              </div>
              <ul className="space-y-2">
                {list.map((item) => (
                  <UpcomingItem key={item.id} item={item} onPay={onPay} />
                ))}
              </ul>
            </section>
          );
        })}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <CalendarClock className="h-6 w-6 text-muted-foreground" />
            <p className="mt-3 font-display text-sm font-bold text-foreground">Aucune échéance immédiate</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tous vos cycles sont à jour. Profitez-en pour rejoindre un nouveau groupe.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

interface UpcomingItemProps {
  item: UpcomingContribution;
  onPay?: (item: UpcomingContribution) => void;
}

function UpcomingItem({ item, onPay }: UpcomingItemProps) {
  const isOverdue = item.bucket === "overdue";
  const isUrgent = item.bucket === "this-week";

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-3",
        isOverdue
          ? "border-destructive/20 bg-destructive/[0.05]"
          : isUrgent
          ? "border-warning/25 bg-warning/[0.05]"
          : "border-hairline bg-secondary/30",
      )}
    >
      <DateChip date={item.date} tone={isOverdue ? "destructive" : isUrgent ? "warning" : "neutral"} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{item.groupName}</p>
        <p className="text-xs text-muted-foreground">
          Cotisation prévue · <span className="num">{formatRelativeDays(item.daysAway)}</span>
        </p>
      </div>

      <div className="hidden text-right sm:block">
        <p className="font-display text-sm font-bold text-foreground num">
          {formatGNF(item.amount, { withCurrency: true })}
        </p>
        <p className={cn("text-[11px]", isOverdue ? "text-destructive" : "text-muted-foreground")}>
          {isOverdue ? "Pénalité possible" : "Frais opérateur 0%"}
        </p>
      </div>

      {item.payable ? (
        <button
          type="button"
          onClick={() => onPay?.(item)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition",
            isOverdue
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-primary text-primary-foreground hover:bg-primary-700",
          )}
        >
          {isOverdue ? <Zap className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
          Payer
        </button>
      ) : (
        <Link
          to={`/groupes/${item.groupId}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-hairline px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Clock className="h-3.5 w-3.5" />
          Programmer
        </Link>
      )}
    </li>
  );
}

function DateChip({
  date,
  tone,
}: {
  date: string;
  tone: "neutral" | "warning" | "destructive";
}) {
  // "5 Jan 2025" or "1 Fév 2025" — extract day and month token.
  const parts = date.split(" ");
  const day = parts[0]?.padStart(2, "0") ?? "—";
  const month = (parts[1] ?? "").slice(0, 3).toUpperCase();

  const toneClass = {
    neutral: "bg-card text-foreground border-hairline",
    warning: "bg-warning/10 text-warning border-warning/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
  }[tone];

  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md border",
        toneClass,
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider">{month}</span>
      <span className="font-display text-base font-bold leading-none num">{day}</span>
    </div>
  );
}
