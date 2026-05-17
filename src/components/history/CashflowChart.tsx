import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { CashflowPoint } from "@/lib/types";

type Range = "12m" | "6m" | "3m";

const ranges: Array<{ id: Range; label: string }> = [
  { id: "12m", label: "12 mois" },
  { id: "6m", label: "6 mois" },
  { id: "3m", label: "3 mois" },
];

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  const [range, setRange] = useState<Range>("12m");

  const series = useMemo(() => {
    const sliceMap: Record<Range, number> = { "12m": 12, "6m": 6, "3m": 3 };
    const limit = sliceMap[range];
    return data.slice(-limit).map((p) => ({
      ...p,
      // Chart needs negative outflow to render below the zero axis.
      outflowChart: -p.outflow,
    }));
  }, [data, range]);

  const totals = useMemo(() => {
    const inflow = series.reduce((s, p) => s + p.inflow, 0);
    const outflow = series.reduce((s, p) => s + p.outflow, 0);
    return { inflow, outflow, net: inflow - outflow };
  }, [series]);

  const yMax = Math.max(...series.map((p) => Math.max(p.inflow, p.outflow))) || 1;

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex flex-col gap-3 border-b border-hairline px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Cash-flow consolidé</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Entrées et sorties mensuelles · trace cumulée du solde
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden items-center gap-3 text-[11px] sm:flex">
            <Legend className="bg-success" label={`Entrées ${formatGNF(totals.inflow, { withCurrency: true, compact: true })}`} />
            <Legend className="bg-muted-foreground/40" label={`Sorties ${formatGNF(totals.outflow, { withCurrency: true, compact: true })}`} />
            <Legend className="bg-primary" label={`Net cumulé ${formatGNF(totals.net, { withCurrency: true, compact: true })}`} />
          </div>
          <div className="inline-flex items-center gap-0.5 rounded-md bg-secondary/60 p-0.5">
            {ranges.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                aria-pressed={range === r.id}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition",
                  range === r.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="px-2 py-5 lg:px-4">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 24, bottom: 0, left: 24 }}>
              <CartesianGrid stroke="hsl(var(--border) / 0.6)" vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 500 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                domain={[-yMax, yMax]}
                tickFormatter={(v: number) =>
                  v === 0 ? "0" : `${v > 0 ? "+" : "−"}${formatGNF(Math.abs(v), { compact: true })}`
                }
                width={70}
              />
              <Tooltip cursor={{ fill: "hsl(var(--secondary) / 0.6)" }} content={<CashflowTooltip />} />
              <Bar dataKey="inflow" name="Entrées" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="outflowChart" name="Sorties" fill="hsl(var(--muted-foreground))" fillOpacity={0.45} radius={[0, 0, 3, 3]} maxBarSize={28} />
              <Line
                type="monotone"
                dataKey="cumulative"
                name="Solde cumulé"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, stroke: "hsl(var(--primary))", strokeWidth: 1.5, fill: "hsl(var(--card))" }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </article>
  );
}

function CashflowTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const inflow = payload.find((p) => p.dataKey === "inflow")?.value ?? 0;
  const outflowRaw = payload.find((p) => p.dataKey === "outflowChart")?.value ?? 0;
  const outflow = Math.abs(Number(outflowRaw));
  const cumulative = payload.find((p) => p.dataKey === "cumulative")?.value ?? 0;

  return (
    <div className="rounded-md border border-hairline bg-popover px-3 py-2 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <dl className="mt-2 space-y-1 text-xs">
        <Row label="Entrées" value={`+${formatGNF(Number(inflow), { withCurrency: true })}`} valueClass="text-success" />
        <Row label="Sorties" value={`−${formatGNF(outflow, { withCurrency: true })}`} />
        <Row label="Solde cumulé" value={`${formatGNF(Number(cumulative), { withCurrency: true })}`} valueClass="text-primary" />
      </dl>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-display font-semibold num", valueClass ?? "text-foreground")}>{value}</dd>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span aria-hidden className={cn("h-2.5 w-2.5 rounded-sm", className)} />
      <span className="text-foreground">{label.split(" ").slice(0, 1).join(" ")}</span>
      <span className="num">{label.split(" ").slice(1).join(" ")}</span>
    </span>
  );
}
