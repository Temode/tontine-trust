import { useMemo, useState } from "react";
import { ArrowLeft, Calendar, CheckCircle2, MoreVertical, Wallet, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import { getGroupById, members, transactions } from "@/lib/mock-data";
import { PaymentModal } from "@/components/payment/PaymentModal";
import type { Member, TontineGroup } from "@/lib/types";

type Section = "overview" | "members" | "history";

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const group = id ? getGroupById(id) : undefined;
  const [section, setSection] = useState<Section>("overview");
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (!group) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-lg font-bold text-foreground">Groupe introuvable</h2>
        <p className="mt-1 text-sm text-muted-foreground">Le groupe demandé n'existe pas ou a été supprimé.</p>
        <Link to="/dashboard" className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  const currentTurnIndex = Math.floor(group.progress / (100 / group.members));
  const turnPayout = group.contribution * group.members;
  const daysToPayment = 5; // Mock — would come from API.

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header className="gradient-primary relative overflow-hidden text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-10">
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative z-10 mx-auto flex max-w-5xl items-center gap-3 px-5 pt-8 pb-6 md:px-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 backdrop-blur transition hover:bg-white/15"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold md:text-xl">{group.name}</h1>
            <p className="text-xs text-white/80">{group.members} membres</p>
          </div>
          <button
            type="button"
            aria-label="Plus d'options"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 backdrop-blur transition hover:bg-white/15"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 md:px-8">
        {/* Cagnotte card */}
        <div className="-mt-3">
          <CagnotteCard group={group} currentTurnIndex={currentTurnIndex} />
        </div>

        {/* Tabs */}
        <div className="mt-4 mb-3 rounded-xl bg-muted p-1" role="tablist" aria-label="Sections du groupe">
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { id: "overview" as const, label: "Aperçu" },
                { id: "members" as const, label: "Membres" },
                { id: "history" as const, label: "Historique" },
              ]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={section === tab.id}
                onClick={() => setSection(tab.id)}
                className={cn(
                  "rounded-lg py-2 text-xs font-medium transition md:text-sm",
                  section === tab.id ? "bg-card text-primary-700 shadow-soft" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {section === "overview" && (
          <OverviewTab
            group={group}
            currentTurnIndex={currentTurnIndex}
            turnPayout={turnPayout}
            daysToPayment={daysToPayment}
            onPay={() => setPaymentOpen(true)}
          />
        )}
        {section === "members" && <MembersTab members={members} />}
        {section === "history" && <HistoryTab groupId={group.id} />}
      </div>

      {/* Sticky pay CTA */}
      {group.status !== "completed" && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-5 md:bottom-6 md:left-64 md:right-0 md:px-8">
          <div className="mx-auto max-w-2xl">
            <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl gradient-primary text-sm font-semibold text-white shadow-primary transition hover:opacity-95 active:scale-[0.98]"
            >
              <Wallet className="h-5 w-5" />
              Payer ma cotisation · {formatGNF(group.contribution, { withCurrency: true })}
            </button>
          </div>
        </div>
      )}

      <PaymentModal group={group} open={paymentOpen} onOpenChange={setPaymentOpen} />
    </div>
  );
}

function CagnotteCard({ group, currentTurnIndex }: { group: TontineGroup; currentTurnIndex: number }) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-card md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Cagnotte actuelle</p>
          <h2 className="mt-1 text-2xl font-bold text-foreground num md:text-3xl">
            <span className="mr-1.5 text-base font-semibold text-accent-600">GNF</span>
            {formatGNF(group.totalCollected)}
          </h2>
        </div>
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl text-white",
            group.status === "your-turn" ? "gradient-accent" : "gradient-primary",
          )}
        >
          <Wallet className="h-6 w-6" strokeWidth={1.75} />
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Tour {currentTurnIndex} sur {group.members}
          </span>
          <span className="font-semibold text-foreground num">{group.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-primary-600 to-primary" style={{ width: `${group.progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Cotisation" value={formatGNF(group.contribution, { withCurrency: true, compact: true })} />
        <Stat label="Fréquence" value={group.frequency} />
        <Stat label="Votre tour" value={`#${group.yourTurn}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-2.5 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-foreground num">{value}</p>
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
    <div className="space-y-3 pb-32">
      {/* Current Turn */}
      <div className="rounded-2xl border border-accent-100 bg-gradient-to-r from-accent-50 to-accent-50/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500 text-base font-bold text-accent-foreground">
            MD
          </div>
          <div className="flex-1">
            <p className="text-xs text-accent-foreground/80">Bénéficiaire actuel</p>
            <p className="text-sm font-bold text-foreground">{group.currentTurn}</p>
            <p className="text-xs text-muted-foreground">Tour #{currentTurnIndex + 1}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Reçoit</p>
            <p className="text-sm font-bold text-accent-600 num">
              {formatGNF(turnPayout, { withCurrency: true, compact: true })}
            </p>
          </div>
        </div>
      </div>

      {/* Next Payment */}
      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <h4 className="mb-2 text-sm font-semibold text-foreground">Prochaine échéance</h4>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
              <Calendar className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{group.nextPaymentDate}</p>
              <p className="text-xs text-muted-foreground">{formatRelativeDays(daysToPayment)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onPay}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
          >
            Payer maintenant
          </button>
        </div>
      </div>

      {/* Rules */}
      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <h4 className="mb-3 text-sm font-semibold text-foreground">Règles du groupe</h4>
        <ul className="space-y-2">
          {group.rules.map((rule, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary-700" />
              </span>
              <span className="text-xs text-muted-foreground">{rule}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MembersTab({ members }: { members: Member[] }) {
  return (
    <div className="space-y-2 pb-32">
      {members.map((member) => (
        <div
          key={member.id}
          className={cn(
            "rounded-2xl bg-card p-3 shadow-soft md:p-4",
            member.isYou && "ring-2 ring-primary",
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold",
                member.isYou ? "gradient-primary text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {member.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                {member.isYou && (
                  <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">Vous</span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Tour #{member.turn}</span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Star className="h-3 w-3 fill-accent-500 text-accent-500" />
                  <span className="font-medium num">{member.reliabilityScore}%</span>
                </span>
              </div>
            </div>
            <div
              aria-label={member.paid ? "Cotisation payée" : "En attente de paiement"}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                member.paid ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {member.paid ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ groupId }: { groupId: string }) {
  const items = useMemo(() => transactions.filter((t) => t.groupId === groupId), [groupId]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-8 text-center shadow-soft">
        <p className="text-sm text-muted-foreground">Aucun mouvement enregistré pour ce groupe.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-soft pb-2">
      {items.map((tx, i, arr) => (
        <div
          key={tx.id}
          className={cn("flex items-center gap-3 px-3 py-3 md:px-4", i !== arr.length - 1 && "border-b border-border/60")}
        >
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              tx.type === "in" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            <Wallet className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {tx.type === "in" ? "Cagnotte reçue" : "Cotisation payée"}
            </p>
            <p className="text-xs text-muted-foreground">{tx.date}</p>
          </div>
          <p className={cn("text-sm font-semibold num", tx.type === "in" ? "text-success" : "text-foreground")}>
            {tx.type === "in" ? "+" : "−"}
            {formatGNF(tx.amount, { withCurrency: true, compact: tx.amount >= 1_000_000 })}
          </p>
        </div>
      ))}
    </div>
  );
}
