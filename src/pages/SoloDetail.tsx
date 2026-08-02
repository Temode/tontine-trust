import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Clock, Loader2, Lock, PiggyBank,
  Plus, Settings2, Target, Wallet2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatGNF } from "@/lib/format";
import {
  getMySoloGroup, listSoloDeposits, startSoloDeposit, updateMySoloGroup,
  type SoloDeposit,
} from "@/lib/api/solo";

const QUICK = [50_000, 100_000, 250_000, 500_000];

export default function SoloDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [depositOpen, setDepositOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const groupQ = useQuery({
    queryKey: ["solo", "detail", id],
    queryFn: () => getMySoloGroup(id),
    enabled: !!id,
  });
  const depositsQ = useQuery({
    queryKey: ["solo", "deposits", id],
    queryFn: () => listSoloDeposits(id),
    enabled: !!id,
  });

  const g = groupQ.data;
  const isProject = g?.solo_mode === "project";
  const locked = !!(isProject && g?.solo_lock_until && new Date(g.solo_lock_until).getTime() > Date.now());
  const target = g?.target_amount ?? 0;
  const pct = target > 0 && g ? Math.min(100, Math.round((g.total_saved / target) * 100)) : null;
  const remaining = target > 0 && g ? Math.max(0, target - g.total_saved) : 0;

  if (groupQ.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar title="Épargne Solo" />
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!g) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar title="Épargne Solo" />
        <main className="mx-auto w-full max-w-3xl px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Cette épargne Solo est introuvable.</p>
          <Button className="mt-4" onClick={() => navigate("/solo")}>Retour à mes épargnes</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar title={g.name} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 sm:py-6 lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link to="/solo" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Mes épargnes Solo
            </Link>
            <h1 className="mt-1 break-words font-display text-xl font-semibold text-foreground sm:text-2xl">{g.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                {isProject ? <Target className="h-3.5 w-3.5" /> : <Wallet2 className="h-3.5 w-3.5" />}
                {isProject ? "Épargne Projet" : "Fonds de roulement"}
              </span>
              <span aria-hidden>·</span>
              <span>Épargne libre — vous déposez ce que vous voulez, quand vous voulez</span>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="icon" aria-label="Réglages" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button className="gap-2" onClick={() => setDepositOpen(true)}>
              <Plus className="h-4 w-4" /> Déposer
            </Button>
          </div>
        </div>

        <section className="rounded-xl border border-hairline bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total épargné</p>
          <p className="mt-1 break-words font-display text-3xl font-semibold text-foreground num">
            {formatGNF(g.total_saved)} <span className="text-base font-medium text-muted-foreground">GNF</span>
          </p>
          {g.pending_amount > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {formatGNF(g.pending_amount)} GNF en attente de confirmation
            </p>
          )}

          {target > 0 ? (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Objectif</span>
                <span className="num font-medium">{formatGNF(target)} GNF</span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct ?? 0}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {pct}% atteint · encore {formatGNF(remaining)} GNF
                {g.solo_lock_until ? ` · échéance ${new Date(g.solo_lock_until).toLocaleDateString("fr-FR")}` : ""}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Aucun objectif défini. Ajoutez-en un dans les réglages pour suivre votre progression.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {locked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                <Lock className="h-3 w-3" /> Retrait bloqué jusqu'au{" "}
                {new Date(g.solo_lock_until!).toLocaleDateString("fr-FR")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 font-medium text-success">
                <CheckCircle2 className="h-3 w-3" /> Retrait disponible
              </span>
            )}
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
              <Link to="/solde">Voir mon solde global</Link>
            </Button>
          </div>
        </section>

        <SectionCard title="Historique des dépôts" bare>
          {depositsQ.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (depositsQ.data ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground lg:px-6">
              Aucun dépôt pour l'instant. Déposez le montant de votre choix pour commencer.
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {(depositsQ.data ?? []).map((d) => <DepositRow key={d.id} d={d} />)}
            </ul>
          )}
        </SectionCard>
      </main>

      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        groupId={g.id}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["solo"] });
        }}
      />
      <SoloSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        groupId={g.id}
        initialName={g.name}
        initialDescription={g.description ?? ""}
        initialTarget={g.target_amount}
        isProject={isProject}
        lockUntil={g.solo_lock_until}
        onDone={() => qc.invalidateQueries({ queryKey: ["solo"] })}
      />
    </div>
  );
}

function DepositRow({ d }: { d: SoloDeposit }) {
  const meta =
    d.status === "confirmed"
      ? { icon: <CheckCircle2 className="h-4 w-4 text-success" />, label: "Confirmé" }
      : d.status === "pending"
      ? { icon: <Clock className="h-4 w-4 text-muted-foreground" />, label: "En attente" }
      : d.status === "failed"
      ? { icon: <XCircle className="h-4 w-4 text-destructive" />, label: "Échoué" }
      : { icon: <XCircle className="h-4 w-4 text-muted-foreground" />, label: "Annulé" };
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {meta.icon}
        <div className="min-w-0">
          <p className="num text-sm font-semibold text-foreground">{formatGNF(d.amount)} GNF</p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(d.confirmed_at ?? d.created_at).toLocaleString("fr-FR")}
            {d.payment_method ? ` · ${d.payment_method}` : ""}
          </p>
        </div>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{meta.label}</span>
    </li>
  );
}

function DepositDialog({
  open, onOpenChange, groupId, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState<string>("");
  const value = Number(amount);

  const alerts = useMemo(() => {
    const list: { level: "error" | "warn"; text: string }[] = [];
    if (amount !== "" && !(value > 0)) list.push({ level: "error", text: "Le montant doit être supérieur à zéro." });
    if (value > 0 && value % 1000 !== 0) list.push({ level: "warn", text: "Montant inhabituel : un multiple de 1 000 GNF est conseillé." });
    return list;
  }, [amount, value]);

  const deposit = useMutation({
    mutationFn: () => startSoloDeposit(groupId, value),
    onSuccess: (r) => {
      onDone();
      window.location.assign(r.redirectUrl);
    },
    onError: (e: Error) => toast.error("Dépôt impossible", { description: e.message }),
  });

  const canSubmit = value > 0 && !alerts.some((a) => a.level === "error");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-md flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 shrink-0 text-primary" />
            <span className="min-w-0 truncate">Déposer sur mon épargne</span>
          </DialogTitle>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <p className="text-sm text-muted-foreground">
            Vous êtes libre : déposez le montant que vous voulez, aussi souvent que vous le souhaitez.
          </p>
          <div>
            <Label htmlFor="solo-deposit-amount">Montant (GNF)</Label>
            <Input
              id="solo-deposit-amount" type="number" inputMode="numeric" min={1}
              value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex : 100000"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <Button key={q} type="button" variant="outline" size="sm" onClick={() => setAmount(String(q))}>
                {formatGNF(q)}
              </Button>
            ))}
          </div>
          {alerts.length > 0 && (
            <ul className="space-y-1.5">
              {alerts.map((a, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
                    a.level === "error" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning-foreground"
                  }`}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="shrink-0 gap-2 sm:gap-2">
          <Button variant="ghost" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="w-full sm:w-auto" onClick={() => deposit.mutate()} disabled={!canSubmit || deposit.isPending}>
            {deposit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Payer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SoloSettingsDialog({
  open, onOpenChange, groupId, initialName, initialDescription, initialTarget, isProject, lockUntil, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  initialName: string;
  initialDescription: string;
  initialTarget: number | null;
  isProject: boolean;
  lockUntil: string | null;
  onDone: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDescription);
  const [target, setTarget] = useState(initialTarget ? String(initialTarget) : "");

  const save = useMutation({
    mutationFn: () =>
      updateMySoloGroup({
        groupId,
        name: name.trim(),
        description: desc,
        targetAmount: target === "" ? null : Number(target),
        clearTarget: target === "",
      }),
    onSuccess: () => {
      toast.success("Réglages enregistrés");
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  const invalid = name.trim().length < 3 || (target !== "" && !(Number(target) > 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-md flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>Réglages de l'épargne</DialogTitle>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div>
            <Label htmlFor="solo-set-name">Nom</Label>
            <Input id="solo-set-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="solo-set-desc">Description</Label>
            <Textarea id="solo-set-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="solo-set-target">Objectif d'épargne (GNF, optionnel)</Label>
            <Input
              id="solo-set-target" type="number" inputMode="numeric" min={1}
              value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Laisser vide pour aucun objectif"
            />
          </div>
          {isProject && lockUntil && (
            <p className="rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              Épargne Projet : les fonds restent bloqués jusqu'au{" "}
              {new Date(lockUntil).toLocaleDateString("fr-FR")}.
            </p>
          )}
        </div>
        <DialogFooter className="shrink-0 gap-2 sm:gap-2">
          <Button variant="ghost" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="w-full sm:w-auto" onClick={() => save.mutate()} disabled={invalid || save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
