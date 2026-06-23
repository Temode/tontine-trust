import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, AlertTriangle, Wallet, Crown } from "lucide-react";
import { formatGNF, formatRelativeDays, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { launchDjomyCheckout } from "@/lib/payment/launchDjomyCheckout";
import type { DbNextTurn } from "@/lib/api/types";

interface MemberPaymentRow {
  contribution_id: string;
  payer_user_id: string;
  status: "pending" | "submitted" | "rejected" | "confirmed" | "defaulted";
  amount: number;
  full_name: string | null;
}

async function loadTurnState(turnId: string): Promise<MemberPaymentRow[]> {
  const { data, error } = await supabase
    .from("contributions")
    .select("id, payer_user_id, status, amount, profile:profiles!contributions_payer_user_id_fkey(full_name)")
    .eq("turn_id", turnId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    contribution_id: r.id,
    payer_user_id: r.payer_user_id,
    status: r.status,
    amount: r.amount,
    full_name: r.profile?.full_name ?? null,
  }));
}

interface Props {
  turn: DbNextTurn | null;
  currentUserId: string | null;
  groupContribution: number;
}

export function CurrentTurnBanner({ turn, currentUserId, groupContribution }: Props) {
  const turnId = turn?.turn_id ?? null;
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["turn-state", turnId],
    queryFn: () => loadTurnState(turnId as string),
    enabled: !!turnId,
    refetchInterval: 30_000,
  });

  if (!turn) {
    return (
      <section className="mt-5 rounded-2xl border border-hairline bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Aucun tour en cours. Démarrez le cycle pour ouvrir la collecte.
        </p>
      </section>
    );
  }

  const myRow = currentUserId ? rows.find((r) => r.payer_user_id === currentUserId) : null;
  const confirmedCount = rows.filter((r) => r.status === "confirmed").length;
  const expectedCount = Math.max(rows.length, 1);
  const collected = rows
    .filter((r) => r.status === "confirmed")
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  const expectedTotal = turn.payout_amount ?? groupContribution * expectedCount;
  const dueDate = new Date(turn.due_date);
  const daysToDue = Math.round(
    (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const overdue = daysToDue < 0;

  const myDue = myRow && (myRow.status === "pending" || myRow.status === "rejected");
  const myConfirmed = myRow?.status === "confirmed";
  const isBeneficiary = currentUserId === turn.beneficiary_user_id;

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-hairline bg-card shadow-[0_6px_20px_-12px_hsl(var(--primary)/0.25)]">
      <header className="flex flex-wrap items-start gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Tour en cours
          </p>
          <h3 className="mt-0.5 font-display text-lg font-bold text-foreground lg:text-xl">
            Tour #{turn.turn_number} · {turn.beneficiary_name ?? "Bénéficiaire"}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive")}>
              <Clock className="h-3.5 w-3.5" />
              {overdue ? `En retard de ${Math.abs(daysToDue)} j` : formatRelativeDays(daysToDue)}
            </span>
            <span>
              Collecté <span className="num font-semibold text-foreground">{formatGNF(collected)}</span>{" "}
              / <span className="num">{formatGNF(expectedTotal, { withCurrency: true })}</span>
            </span>
            <span>
              {confirmedCount}/{expectedCount} membres
            </span>
          </p>
        </div>

        {myDue && (
          <button
            type="button"
            onClick={() => void launchDjomyCheckout(myRow!.contribution_id)}
            className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-700"
          >
            <Wallet className="h-4 w-4" />
            Payer {formatGNF(myRow!.amount, { withCurrency: true })}
          </button>
        )}
        {!myDue && myConfirmed && (
          <span className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-success/10 px-4 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" />
            Vous avez payé
          </span>
        )}
        {!myRow && currentUserId && (
          <Link
            to="/solde"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-hairline px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Voir mon solde
          </Link>
        )}
      </header>

      <div className="px-2 py-2 lg:px-3 lg:py-3">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-secondary/50" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => {
              const isBenef = r.payer_user_id === turn.beneficiary_user_id;
              const isMe = r.payer_user_id === currentUserId;
              const name = r.full_name ?? "Membre";
              return (
                <li
                  key={r.contribution_id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-foreground">
                    {getInitials(name) || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                      <span className="truncate">{name}</span>
                      {isMe && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                          Vous
                        </span>
                      )}
                      {isBenef && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-foreground">
                          <Crown className="h-2.5 w-2.5" />
                          Bénéficiaire
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <StatusPill status={r.status} overdue={overdue} />
                    </p>
                  </div>
                  <span className="num shrink-0 text-sm font-semibold text-foreground">
                    {formatGNF(r.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isBeneficiary && (
        <footer className="border-t border-hairline bg-accent-50/40 px-5 py-3 text-xs text-muted-foreground lg:px-6">
          Vous êtes le bénéficiaire de ce tour : dès que toutes les cotisations sont confirmées, votre solde est crédité automatiquement et vous pouvez retirer depuis{" "}
          <Link to="/solde" className="font-semibold text-primary underline-offset-2 hover:underline">
            « Mon solde »
          </Link>
          .
        </footer>
      )}
    </section>
  );
}

function StatusPill({ status, overdue }: { status: MemberPaymentRow["status"]; overdue: boolean }) {
  return <StatusPillImpl status={status} overdue={overdue} daysLate={0} />;
}

function StatusPillImpl({ status, overdue, daysLate }: { status: MemberPaymentRow["status"]; overdue: boolean; daysLate: number }) {
  if (status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <CheckCircle2 className="h-3 w-3" />
        Payé
      </span>
    );
  }
  if (status === "submitted") {
    return (
      <span className="inline-flex items-center gap-1 text-primary">
        <Clock className="h-3 w-3" />
        En vérification
      </span>
    );
  }
  if (status === "defaulted") {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <AlertTriangle className="h-3 w-3" />
        Défaut
      </span>
    );
  }
  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive">
        <AlertTriangle className="h-3 w-3" />
        En retard{daysLate > 0 ? ` J+${daysLate}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Clock className="h-3 w-3" />
      En attente
    </span>
  );
}