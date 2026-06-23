import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Wallet, TrendingUp, History, CheckCircle2, Clock, XCircle, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { listMyBalances, listMyWithdrawals, type DbMyBalance, type DbWithdrawalRequest } from "@/lib/api/balances";
import { listMyHeldPayouts } from "@/lib/api/holdPayouts";
import { formatGNF } from "@/lib/format";
import { WithdrawDialog } from "@/components/balance/WithdrawDialog";
import { PayoutHoldHistory } from "@/components/balance/PayoutHoldHistory";
import { useTontineRealtime } from "@/hooks/useTontineRealtime";
import { cn } from "@/lib/utils";

const METHOD_LABEL: Record<string, string> = {
  OM: "Orange Money",
  MOMO: "MTN MoMo",
  CARD: "Carte",
  BANK: "Virement",
  CASH: "Espèces",
};

export default function MyBalance() {
  useTontineRealtime();
  const [selected, setSelected] = useState<DbMyBalance | null>(null);

  const balancesQ = useQuery({
    queryKey: ["my-balances"],
    queryFn: listMyBalances,
  });
  const withdrawalsQ = useQuery({
    queryKey: ["my-withdrawals"],
    queryFn: listMyWithdrawals,
  });
  const heldQ = useQuery({
    queryKey: ["my-held-payouts"],
    queryFn: listMyHeldPayouts,
  });

  const balances = balancesQ.data ?? [];
  const totalAvailable = balances.reduce((s, b) => s + b.available_amount, 0);
  const totalCredited = balances.reduce((s, b) => s + b.total_credited, 0);
  const totalWithdrawn = balances.reduce((s, b) => s + b.total_withdrawn, 0);
  const heldPayouts = heldQ.data ?? [];
  const totalHeld = heldPayouts.reduce((s, h) => s + h.payout_amount, 0);

  return (
    <div className="animate-fade-in">
      <header className="sticky top-0 z-30 border-b border-hairline bg-card/85 backdrop-blur">
        <div className="flex items-center gap-3 px-5 py-4 lg:px-8">
          <Link
            to="/dashboard"
            aria-label="Retour"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Vos cagnottes reçues</p>
            <h1 className="truncate font-display text-xl font-bold text-foreground lg:text-2xl">Mon solde</h1>
          </div>
        </div>
      </header>

      <div className="px-5 py-6 lg:px-8 lg:py-8">
        {/* Hero solde total */}
        <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-700 p-6 text-primary-foreground shadow-[0_24px_60px_-30px_hsl(var(--primary)/0.7)] lg:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground/80">
              Solde total disponible
            </p>
            <p className="num mt-2 font-display text-4xl font-bold leading-none lg:text-5xl">
              {formatGNF(totalAvailable)}
              <span className="ml-2 text-base font-medium text-accent">GNF</span>
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Total crédité" value={`${formatGNF(totalCredited)} GNF`} icon={TrendingUp} />
              <Metric label="Total retiré" value={`${formatGNF(totalWithdrawn)} GNF`} icon={History} />
              <Metric label="Groupes" value={String(balances.length)} icon={Wallet} />
            </dl>
          </div>
        </article>

        {/* Fonds en attente de libération */}
        {heldPayouts.length > 0 && (
          <section className="mt-5 rounded-xl border-2 border-amber-400 bg-amber-50/60 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                <Lock className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Fonds en attente de libération
                </p>
                <p className="mt-0.5 font-display text-base font-bold text-amber-950 num">
                  {formatGNF(totalHeld)} GNF
                </p>
                <ul className="mt-2 space-y-1">
                  {heldPayouts.map((h) => (
                    <li key={h.id} className="text-xs text-amber-900/90">
                      <span className="font-semibold">{h.group_name ?? "Groupe"}</span> — tour #{h.turn_number} ·
                      libération le{" "}
                      {new Date(h.payout_hold_until).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                      {" "}· {formatGNF(h.payout_amount)} GNF
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-amber-800/80">
                  Retard de cotisation durant ce cycle : la libération de votre payout est repoussée de 7 jours.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Liste des soldes par groupe */}
        <h2 className="mt-8 font-display text-base font-bold text-foreground">Par groupe</h2>
        {balancesQ.isLoading ? (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-secondary/50" />
            ))}
          </div>
        ) : balances.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-3 space-y-2">
            {balances.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-card p-4 lg:p-5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-foreground">{b.group_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Crédité <span className="num">{formatGNF(b.total_credited)}</span> ·
                    Retiré <span className="num">{formatGNF(b.total_withdrawn)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Disponible</p>
                  <p className="num font-display text-lg font-bold text-accent">
                    {formatGNF(b.available_amount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(b)}
                  disabled={b.available_amount <= 0}
                  className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-40"
                >
                  <Wallet className="h-4 w-4" />
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Historique des retraits */}
        <h2 className="mt-8 font-display text-base font-bold text-foreground">Historique des retraits</h2>
        {withdrawalsQ.isLoading ? (
          <div className="mt-3 space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-secondary/50" />
            ))}
          </div>
        ) : (withdrawalsQ.data ?? []).length === 0 ? (
          <p className="mt-3 rounded-xl border border-hairline bg-card p-5 text-sm text-muted-foreground">
            Aucun retrait pour l'instant.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border border-hairline bg-card">
            {(withdrawalsQ.data ?? []).map((w) => (
              <WithdrawalRow key={w.id} w={w} />
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <WithdrawDialog
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          groupId={selected.group_id}
          groupName={selected.group_name}
          available={selected.available_amount}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 px-3 py-2.5 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/70">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="num mt-0.5 text-base font-bold">{value}</p>
    </div>
  );
}

function WithdrawalRow({ w }: { w: DbWithdrawalRequest }) {
  const Icon =
    w.status === "paid" ? CheckCircle2 : w.status === "failed" || w.status === "cancelled" ? XCircle : Clock;
  const tone =
    w.status === "paid"
      ? "text-success"
      : w.status === "failed" || w.status === "cancelled"
      ? "text-destructive"
      : "text-primary";
  return (
    <li className="flex items-center gap-3 px-4 py-3 lg:px-5">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary", tone)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {METHOD_LABEL[w.method] ?? w.method}
          {w.destination ? ` · ${w.destination}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(w.created_at).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" · "}
          <span className={cn("font-semibold", tone)}>{statusLabel(w.status)}</span>
        </p>
      </div>
      <span className="num shrink-0 font-display text-sm font-bold text-foreground">
        {formatGNF(w.amount, { withCurrency: true })}
      </span>
    </li>
  );
}

function statusLabel(s: DbWithdrawalRequest["status"]): string {
  switch (s) {
    case "pending":
      return "En attente";
    case "processing":
      return "En traitement";
    case "paid":
      return "Payé";
    case "failed":
      return "Échoué";
    case "cancelled":
      return "Annulé";
    default:
      return s;
  }
}

function EmptyState() {
  return (
    <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-dashed border-hairline bg-card/60 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary">
        <Wallet className="h-5 w-5" />
      </div>
      <h3 className="font-display text-base font-bold text-foreground">Aucun solde pour l'instant</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        Votre solde se crédite automatiquement dès que vous êtes bénéficiaire d'un tour et que toutes les cotisations sont confirmées.
      </p>
      <Link
        to="/groupes"
        className="mt-2 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700"
      >
        Voir mes tontines
      </Link>
    </div>
  );
}