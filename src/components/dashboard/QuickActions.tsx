import { CreditCard, FileText, PlusCircle, Repeat, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface QuickActionLink {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  toneBg: string;
  toneText: string;
}

const links: QuickActionLink[] = [
  { to: "/nouveau", label: "Créer un groupe", description: "Démarrer une nouvelle tontine", icon: PlusCircle, toneBg: "bg-primary-50", toneText: "text-primary" },
  { to: "/inviter", label: "Inviter des membres", description: "Partager un lien d'invitation", icon: UserPlus, toneBg: "bg-accent-50", toneText: "text-accent-700" },
  { to: "/echange", label: "Échanger mon tour", description: "Proposer un échange", icon: Repeat, toneBg: "bg-secondary", toneText: "text-foreground" },
  { to: "/recus", label: "Mes reçus", description: "Télécharger les justificatifs", icon: FileText, toneBg: "bg-success/10", toneText: "text-success" },
];

export function PayCard({ onPay }: { onPay?: () => void }) {
  return (
    <article className="relative overflow-hidden rounded-xl bg-primary p-6 text-primary-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-primary-foreground/15 blur-3xl" />
      </div>
      <div className="relative">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-foreground/10">
          <CreditCard className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h3 className="mt-4 font-display text-lg font-bold">Payer ma cotisation</h3>
        <p className="mt-1 text-sm text-primary-100/85">
          Effectuez votre paiement via Orange Money ou MTN Mobile Money. Confirmation instantanée.
        </p>
        <button
          type="button"
          onClick={onPay}
          className="mt-5 h-10 w-full rounded-lg bg-card text-sm font-semibold text-primary transition hover:bg-card/90"
        >
          Payer maintenant
        </button>
      </div>
    </article>
  );
}

export function QuickLinks() {
  return (
    <article className="rounded-xl border border-hairline bg-card p-6">
      <h3 className="mb-4 font-display text-base font-bold text-foreground">Actions rapides</h3>
      <ul className="space-y-1">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/60"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.toneBg} ${item.toneText}`}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
