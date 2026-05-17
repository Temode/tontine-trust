interface ReliabilityCardProps {
  score: number;
  onTime: { current: number; total: number };
  late: number;
  memberSince: string;
}

export function ReliabilityCard({ score, onTime, late, memberSince }: ReliabilityCardProps) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let label = "Excellent";
  if (score < 90) label = "Bon";
  if (score < 75) label = "À améliorer";

  return (
    <article className="rounded-xl border border-hairline bg-card p-6">
      <header className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-foreground">Score de fiabilité</h3>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">FICO interne</span>
      </header>

      <div className="flex items-center justify-center">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="url(#reliability-gradient)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
            <defs>
              <linearGradient id="reliability-gradient" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="hsl(var(--success))" />
                <stop offset="1" stopColor="hsl(var(--primary))" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-bold text-foreground num">{score}%</span>
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </div>
        </div>
      </div>

      <dl className="mt-5 space-y-2 text-sm">
        <Row label="Paiements à temps" value={`${onTime.current}/${onTime.total}`} valueClass="text-success" />
        <Row label="Retards" value={String(late)} />
        <Row label="Membre depuis" value={memberSince} />
      </dl>
    </article>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-medium num ${valueClass ?? "text-foreground"}`}>{value}</dd>
    </div>
  );
}
