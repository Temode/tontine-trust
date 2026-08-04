import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, PieChart as PieIcon } from "lucide-react";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { formatGNF } from "@/lib/format";
import type { DbPaymentHistoryRow } from "@/lib/api/payments";
import type { DbContributionDue } from "@/lib/api/contributions";
import type { DbReceipt } from "@/lib/api/payouts";

interface DashboardChartsProps {
  payments: DbPaymentHistoryRow[];
  receipts: DbReceipt[];
  dues: DbContributionDue[];
}

const MONTHS_BACK = 6;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short" });
}

export function DashboardCharts({ payments, receipts, dues }: DashboardChartsProps) {
  const series = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; date: Date }[] = [];
    for (let i = MONTHS_BACK - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d), label: monthLabel(d), date: d });
    }
    const paidByMonth = new Map<string, number>();
    payments
      .filter((p) => p.status === "succeeded")
      .forEach((p) => {
        const k = monthKey(new Date(p.initiated_at));
        paidByMonth.set(k, (paidByMonth.get(k) ?? 0) + p.amount);
      });
    const receivedByMonth = new Map<string, number>();
    receipts.forEach((r) => {
      const k = monthKey(new Date(r.issued_at));
      receivedByMonth.set(k, (receivedByMonth.get(k) ?? 0) + (r.net_amount ?? r.amount));
    });
    return months.map((m) => ({
      label: m.label,
      paid: paidByMonth.get(m.key) ?? 0,
      received: receivedByMonth.get(m.key) ?? 0,
    }));
  }, [payments, receipts]);

  const repartition = useMemo(() => {
    let late = 0;
    let upcoming = 0;
    dues.forEach((d) => {
      if (d.days_to_due < 0 || d.expected_penalty > 0) late++;
      else upcoming++;
    });
    const paid = payments.filter((p) => p.status === "succeeded").length;
    return [
      { name: "Payées", value: paid, color: "hsl(var(--success))" },
      { name: "À venir", value: upcoming, color: "hsl(var(--primary))" },
      { name: "En retard", value: late, color: "hsl(var(--destructive))" },
    ].filter((s) => s.value > 0);
  }, [dues, payments]);

  const hasData =
    series.some((s) => s.paid > 0 || s.received > 0) || repartition.length > 0;

  if (!hasData) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <SectionCard
        className="lg:col-span-2"
        title="Activité financière"
        subtitle="Cotisations versées et cagnottes reçues"
        rightSlot={
          <span className="hidden items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary sm:inline-flex">
            <TrendingUp className="h-3 w-3" />
            6 mois
          </span>
        }
        contentClassName="p-2 sm:p-4"
      >
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="recvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--accent-600))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--accent-600))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${Math.round(v / 1_000)}k` : String(v)
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number, name: string) => [`${formatGNF(v)} GNF`, name]}
              />
              <Area
                type="monotone"
                dataKey="paid"
                name="Cotisations versées"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#paidGrad)"
              />
              <Area
                type="monotone"
                dataKey="received"
                name="Cagnottes reçues"
                stroke="hsl(var(--accent-600))"
                strokeWidth={2}
                fill="url(#recvGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title="Répartition"
        subtitle="Vos cotisations en un coup d'œil"
        rightSlot={<PieIcon className="h-4 w-4 text-muted-foreground" />}
        contentClassName="p-3 sm:p-4"
      >
        {repartition.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Aucune donnée à afficher.
          </p>
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Pie
                  data={repartition}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {repartition.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </div>
  );
}