import { useMemo, useState } from "react";
import { ArrowLeft, Calendar, CheckCircle2, MoreVertical, Star, Wallet, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import { getGroupById, members, transactions } from "@/lib/mock-data";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { SectionCard } from "@/components/dashboard/SectionCard";
import type { Member, TontineGroup } from "@/lib/types";

type Section = "overview" | "members" | "history";

const tabs: Array<{ id: Section; label: string }> = [
  { id: "overview", label: "Aperçu" },
  { id: "members", label: "Membres" },
  { id: "history", label: "Historique" },
];

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const group = id ? getGroupById(id) : undefined;
  const [section, setSection] = useState<Section>("overview");
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (!group) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="font-display text-lg font-bold text-foreground">Groupe introuvable</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ce groupe n'existe pas ou a été supprimé.</p>
        <Link
          to="/dashboard"
          className="mt-6 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  const turnsCompleted = Math.round((group.progress / 100) * group.members);
  const turnPayout = group.contribution * group.members;
  const daysToPayment = 5;
  const isYourTurn = group.status === "your-turn";

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-card/85 backdrop-blur">
        <div className="flex items-center gap-3 px-5 py-4 lg:px-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Groupe de tontine</p>
            <h1 className="truncate font-display text-xl font-bold text-foreground lg:text-2xl">{group.name}</h1>
          </div>
          <button
            type="button"
            aria-label="Plus d'options"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline text-muted-foreground transition hover:text-foreground"
          >
            <MoreVertical className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <div className="px-5 py-6 lg:px-8 lg:py-8">
        {/* Top — Cagnotte + meta */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <article
            className={cn(
              "relative overflow-hidden rounded-xl p-6 text-primary-foreground lg:col-span-2",
              isYourTurn ? "bg-accent-700" : "bg-primary",
            )}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-15">
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary-foreground/15 blur-3xl" />
            </div>
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-primary-100/80">Cagnotte du tour en cours</p>
                  <p className="mt-2 font-display text-4xl font-bold leading-none num">
                    {formatGNF(group.totalCollected)}
                    <span className="ml-2 text-lg font-medium text-primary-100/70">GNF</span>
                  </p>
                  <p className="mt-3 text-sm text-primary-100/85">
                    Tour {turnsCompleted} sur {group.members} · {group.frequency.toLowerCase()} · cotisation {formatGNF(group.contribution, { withCurrency: true })}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-foreground/10">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wider text-primary-100/70">
                  <span>Progression</span>
                  <span className="num">{group.progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-primary-foreground/15">
                  <div className="h-full rounded-full bg-primary-foreground/80" style={{ width: `${group.progress}%` }} />
                </div>
              </div>
            </div>
          </article>

          <div className="grid grid-cols-3 gap-3 rounded-xl border border-hairline bg-card p-3 lg:grid-cols-1 lg:p-2">
            <Meta label="Cotisation" value={formatGNF(group.contribution, { withCurrency: true })} />
            <Meta label="Fréquence" value={group.frequency} />
            <Meta label="Votre tour" value={`#${group.yourTurn}`} />
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 inline-flex items-center gap-1 rounded-lg border border-hairline bg-card p-1" role="tablist" aria-label="Sections du groupe">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={section === tab.id}
              onClick={() => setSection(tab.id)}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-medium transition lg:text-sm",
                section === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {section === "overview" && (
            <OverviewTab
              group={group}
              currentTurnIndex={turnsCompleted}
              turnPayout={turnPayout}
              daysToPayment={daysToPayment}
              onPay={() => setPaymentOpen(true)}
            />
          )}
          {section === "members" && <MembersTab members={members} />}
          {section === "history" && <HistoryTab groupId={group.id} />}
        </div>
      </div>

      <PaymentModal group={group} open={paymentOpen} onOpenChange={setPaymentOpen} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md px-3 py-2 lg:flex lg:items-center lg:justify-between">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-sm font-bold text-foreground num lg:mt-0">{value}</p>
    </div>
  );
}

interface OverviewTabProps {
  group: TontineGroup;
  currentTurnIndex: number;
  turnPayout: number;
  daysToPayment: number;
  onPay: () => void;
}

function OverviewTab({ group, currentTurnIndex, turnPayout, daysToPayment, onPay }: OverviewTabProps) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {/* Beneficiary */}
        <article className="rounded-xl border border-accent-100 bg-accent-50/60 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-600 text-base font-bold text-accent-foreground">
              MD
            </div>
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-wider text-accent-700">Bénéficiaire actuel</p>
              <p className="font-display text-base font-bold text-foreground">{group.currentTurn}</p>
              <p className="text-xs text-muted-foreground">Tour #{currentTurnIndex + 1}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Reçoit</p>
              <p className="font-display text-lg font-bold text-accent-700 num">
                {formatGNF(turnPayout, { withCurrency: true })}
              </p>
            </div>
          </div>
        </article>

        {/* Next deadline */}
        <article className="rounded-xl border border-hairline bg-card p-5">
          <h4 className="font-display text-sm font-bold text-foreground">Prochaine échéance</h4>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <span className="text-[10px] font-bold uppercase tracking-wider">JAN</span>
                <span className="font-display text-base font-bold leading-none">15</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{group.nextPaymentDate}</p>
                <p className="text-xs text-muted-foreground">{formatRelativeDays(daysToPayment)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onPay}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
            >
              Payer maintenant
            </button>
          </div>
        </article>
      </div>

      <article className="rounded-xl border border-hairline bg-card p-5">
        <h4 className="mb-3 font-display text-sm font-bold text-foreground">Règles du groupe</h4>
        <ul className="space-y-2.5">
          {group.rules.map((rule, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50">
                <CheckCircle2 className="h-3 w-3 text-primary" strokeWidth={2.25} />
              </span>
              <span className="text-xs text-muted-foreground">{rule}</span>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function MembersTab({ members }: { members: Member[] }) {
  return (
    <SectionCard title="Membres du groupe" subtitle={`${members.length} participants`} bare>
      <ul className="divide-y divide-border/60">
        {members.map((member) => (
          <li
            key={member.id}
            className={cn(
              "flex items-center gap-3 px-5 py-3.5 lg:px-6",
              member.isYou && "bg-primary-50/40",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold",
                member.isYou ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
              )}
            >
              {member.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                {member.isYou && (
                  <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Vous
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Tour #{member.turn}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-accent-500 text-accent-500" />
                  <span className="num">{member.reliabilityScore}%</span>
                </span>
              </div>
            </div>
            <span
              aria-label={member.paid ? "Cotisation payée" : "En attente de paiement"}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full",
                member.paid ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {member.paid ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function HistoryTab({ groupId }: { groupId: string }) {
  const items = useMemo(() => transactions.filter((t) => t.groupId === groupId), [groupId]);

  if (items.length === 0) {
    return (
      <SectionCard title="Historique" subtitle="Aucune opération">
        <p className="text-sm text-muted-foreground">Aucun mouvement enregistré pour ce groupe.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Historique" subtitle={`${items.length} opérations`} bare>
      <ul className="divide-y divide-border/60">
        {items.map((tx) => (
          <li key={tx.id} className="flex items-center gap-3 px-5 py-3.5 lg:px-6">
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md",
                tx.type === "in" ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
              )}
            >
              <Calendar className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {tx.type === "in" ? "Cagnotte reçue" : "Cotisation payée"}
              </p>
              <p className="text-xs text-muted-foreground">{tx.date}</p>
            </div>
            <p
              className={cn(
                "font-display text-sm font-semibold num",
                tx.type === "in" ? "text-success" : "text-foreground",
              )}
            >
              {tx.type === "in" ? "+" : "−"}
              {formatGNF(tx.amount, { withCurrency: true })}
            </p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
