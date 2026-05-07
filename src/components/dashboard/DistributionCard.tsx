import type { GroupDistribution } from "@/lib/mock-data";

export function DistributionCard({ items }: { items: GroupDistribution[] }) {
  return (
    <article className="rounded-xl border border-hairline bg-card p-6">
      <header className="mb-4">
        <h3 className="font-display text-base font-bold text-foreground">Répartition par groupe</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Part de votre solde immobilisé</p>
      </header>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.groupId}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium text-foreground num">{item.share}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className={`h-full rounded-full ${item.toneClass}`} style={{ width: `${item.share}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
