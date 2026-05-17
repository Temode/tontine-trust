import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import type { Deadline } from "@/lib/mock-data";

const variants: Record<
  "urgent" | "neutral" | "receiving",
  { wrap: string; chip: string; chipText: string; amount: string; days: string }
> = {
  urgent: {
    wrap: "bg-destructive/[0.06] border-destructive/15",
    chip: "bg-destructive/10",
    chipText: "text-destructive",
    amount: "text-destructive",
    days: "text-destructive/80",
  },
  neutral: {
    wrap: "bg-secondary/40 border-hairline",
    chip: "bg-card border border-hairline",
    chipText: "text-muted-foreground",
    amount: "text-foreground",
    days: "text-muted-foreground",
  },
  receiving: {
    wrap: "bg-success/[0.07] border-success/15",
    chip: "bg-success/10",
    chipText: "text-success",
    amount: "text-success",
    days: "text-success/80",
  },
};

function variantOf(d: Deadline): keyof typeof variants {
  if (d.type === "receiving") return "receiving";
  if (d.urgent) return "urgent";
  return "neutral";
}

export function DeadlineItem({ deadline }: { deadline: Deadline }) {
  const v = variants[variantOf(deadline)];
  const isReceiving = deadline.type === "receiving";

  return (
    <li className={cn("flex items-center gap-3 rounded-lg border p-3.5", v.wrap)}>
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg",
          v.chip,
          v.chipText,
        )}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider">{deadline.date.month}</span>
        <span className="font-display text-base font-bold leading-none">{deadline.date.day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{deadline.groupName}</p>
        <p className={cn("text-xs", isReceiving ? "font-medium text-success" : "text-muted-foreground")}>
          {isReceiving ? "Vous recevez" : "Cotisation à payer"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("font-display text-sm font-bold num", v.amount)}>
          {isReceiving ? "+" : ""}
          {formatGNF(deadline.amount, { withCurrency: true })}
        </p>
        <p className={cn("text-[11px]", v.days)}>{formatRelativeDays(deadline.daysAway)}</p>
      </div>
    </li>
  );
}

export function DeadlinesList({ deadlines }: { deadlines: Deadline[] }) {
  return (
    <ul className="space-y-3">
      {deadlines.map((d) => (
        <DeadlineItem key={d.id} deadline={d} />
      ))}
    </ul>
  );
}
