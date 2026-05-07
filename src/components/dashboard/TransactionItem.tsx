import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export function TransactionItem({ tx, withDivider }: { tx: Transaction; withDivider?: boolean }) {
  const isIncoming = tx.type === "in";
  const Icon = isIncoming ? ArrowDownLeft : ArrowUpRight;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-3 md:px-4",
        withDivider && "border-b border-border/60",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          isIncoming ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{tx.groupName}</p>
        <p className="text-xs text-muted-foreground">{tx.date}</p>
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-semibold num",
          isIncoming ? "text-success" : "text-foreground",
        )}
      >
        {isIncoming ? "+" : "−"}
        {formatGNF(tx.amount, { withCurrency: true, compact: tx.amount >= 1_000_000 })}
      </p>
    </div>
  );
}
