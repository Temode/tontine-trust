import { Award, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReliabilityFactor } from "@/lib/mock-data";

interface ReliabilityBreakdownProps {
  score: number;
  factors: ReliabilityFactor[];
}

export function ReliabilityBreakdown({ score, factors }: ReliabilityBreakdownProps) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const label = score >= 95 ? "Premium" : score >= 85 ? "Excellent" : score >= 70 ? "Bon" : "À améliorer";

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Score de fiabilité</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Décomposition pondérée du score interne Tontine Digital
          </p>
        </div>
        <span className="hidden rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
          Mis à jour à l'instant
        </span>
      </header>

      <div className="grid grid-cols-1 gap-px border-b border-hairline bg-border lg:grid-cols-[auto_1fr]">
        {/* Big gauge */}
        <section className="bg-card px-5 py-6 text-center lg:px-8">
          <div className="relative mx-auto h-32 w-32">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="url(#reliability-gradient-profile)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
              <defs>
                <linearGradient
                  id="reliability-gradient-profile"
                  x1="0"
                  y1="0"
                  x2="100"
                  y2="0"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0" stopColor="hsl(var(--success))" />
                  <stop offset="1" stopColor="hsl(var(--primary))" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-3xl font-bold text-foreground num">{score}%</span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
            </div>
          </div>

          <p className="mx-auto mt-4 inline-flex max-w-[200px] items-start gap-1.5 text-[11px] text-muted-foreground">
            <Award className="mt-0.5 h-3 w-3 text-accent-700" />
            <span>
              Top 5% des utilisateurs Tontine Digital — accès prioritaire aux émissions premium.
            </span>
          </p>
        </section>

        {/* Factors */}
        <section className="bg-card px-5 py-6 lg:px-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Facteurs contributifs
          </p>
          <ul className="space-y-3">
            {factors.map((f) => (
              <Factor key={f.id} factor={f} />
            ))}
          </ul>
        </section>
      </div>

      <footer className="flex items-center gap-2 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
        <TrendingUp className="h-3.5 w-3.5 text-success" />
        Score recalculé à chaque cotisation, encaissement ou décision de gouvernance.
      </footer>
    </article>
  );
}

function Factor({ factor }: { factor: ReliabilityFactor }) {
  const tone =
    factor.value >= 90 ? "bg-success" : factor.value >= 70 ? "bg-primary" : factor.value >= 50 ? "bg-warning" : "bg-destructive";

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{factor.label}</p>
          <p className="text-[11px] text-muted-foreground">{factor.hint}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-sm font-bold text-foreground num">
            {factor.value}
            {factor.unit ?? ""}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Pondération <span className="num text-foreground">{factor.weight}%</span>
          </p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${factor.value}%` }} />
      </div>
    </li>
  );
}
