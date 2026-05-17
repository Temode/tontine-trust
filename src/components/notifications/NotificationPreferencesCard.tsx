import { ArrowRight, Bell, Mail, MessageSquare, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";

interface Channel {
  Icon: typeof Bell;
  label: string;
  status: string;
  tone: "success" | "muted";
}

const CHANNELS: Channel[] = [
  { Icon: MessageSquare, label: "SMS Orange / MTN", status: "Temps réel", tone: "success" },
  { Icon: Smartphone, label: "Push application", status: "Temps réel", tone: "success" },
  { Icon: Mail, label: "E-mail", status: "Désactivé", tone: "muted" },
];

export function NotificationPreferencesCard() {
  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Canaux actifs</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Synchronisation des alertes vers vos appareils
          </p>
        </div>
        <Link
          to="/profil"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:text-primary-700"
        >
          Configurer
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <ul className="divide-y divide-border/50">
        {CHANNELS.map((c) => {
          const Icon = c.Icon;
          return (
            <li key={c.label} className="flex items-center gap-3 px-5 py-3.5 lg:px-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50 text-primary">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{c.label}</p>
                <p className="text-[11px] text-muted-foreground">{c.status}</p>
              </div>
              <span
                className={
                  c.tone === "success"
                    ? "inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success"
                    : "inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                }
              >
                <span
                  aria-hidden
                  className={
                    c.tone === "success"
                      ? "h-1.5 w-1.5 rounded-full bg-success"
                      : "h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
                  }
                />
                {c.tone === "success" ? "Actif" : "OFF"}
              </span>
            </li>
          );
        })}
      </ul>

      <footer className="border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
        <p>
          <span className="font-semibold text-foreground">Mode silence :</span> 22h00 — 06h00.
          Les alertes critiques (sécurité, KYC, paiement échoué) restent envoyées en temps réel.
        </p>
      </footer>
    </article>
  );
}
