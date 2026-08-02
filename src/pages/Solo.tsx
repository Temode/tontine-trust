import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PiggyBank, Plus, Target, Wallet2, Lock, CheckCircle2, AlertTriangle, Info, Crown } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatGNF } from "@/lib/format";
import {
  createSoloGroup,
  listMySoloGroups,
  type SoloFrequency,
  type SoloMode,
  type SoloQuotaError,
} from "@/lib/api/solo";
import { useEntitlements } from "@/hooks/useEntitlements";

export default function Solo() {
  const qc = useQueryClient();
  const { entitlements } = useEntitlements();
  const listQ = useQuery({ queryKey: ["solo", "mine"], queryFn: listMySoloGroups });
  const [open, setOpen] = useState(false);

  const maxSolo = entitlements.limits?.max_solo ?? 0;
  const used = listQ.data?.filter((g) => g.status !== "archived").length ?? 0;
  const canCreate = maxSolo === -1 || used < maxSolo;

  const create = useMutation({
    mutationFn: createSoloGroup,
    onSuccess: () => {
      toast.success("Tontine Solo créée", {
        description: "Confirmation envoyée par e-mail et SMS.",
      });
      qc.invalidateQueries({ queryKey: ["solo", "mine"] });
      qc.invalidateQueries({ queryKey: ["entitlements"] });
      setOpen(false);
    },
    onError: (e: SoloQuotaError) =>
      toast.error("Création impossible", {
        description: e.message,
        action:
          e.code === "QUOTA_SOLO_EXCEEDED"
            ? { label: "Voir les plans", onClick: () => { window.location.href = "/abonnement"; } }
            : undefined,
      }),
  });

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="Tontines Solo" />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-5 sm:py-6 lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold text-foreground sm:text-2xl">Épargne Solo</h1>
            <p className="text-sm text-muted-foreground">
              Épargne personnelle : Épargne Projet (bloquée jusqu'à une date) ou Fonds de roulement (libre).
            </p>
          </div>
          <Button onClick={() => setOpen(true)} disabled={!canCreate} className="w-full gap-2 sm:w-auto sm:shrink-0">
            <Plus className="h-4 w-4" /> Nouvelle
          </Button>
        </div>

        {!canCreate && maxSolo === 0 && (
          <div className="rounded-md border border-hairline bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
            Votre plan actuel n'inclut pas la tontine Solo.{" "}
            <Link to="/abonnement" className="underline">Passez au plan Premium ou Business</Link> pour créer une épargne Solo.
          </div>
        )}
        {!canCreate && maxSolo > 0 && (
          <div className="rounded-md border border-hairline bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
            Vous avez atteint le quota Solo de votre plan ({used}/{maxSolo}).{" "}
            <Link to="/abonnement" className="underline">Passez à un plan supérieur</Link> pour continuer.
          </div>
        )}

        {listQ.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (listQ.data ?? []).length === 0 ? (
          <SectionCard title="Aucune tontine Solo" bare>
            <p className="px-5 py-6 text-sm text-muted-foreground lg:px-6">
              Créez votre première tontine Solo pour commencer à épargner à votre rythme.
            </p>
          </SectionCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(listQ.data ?? []).map((g) => <SoloCard key={g.id} g={g} />)}
          </div>
        )}
      </main>

      <CreateSoloDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(input) => create.mutate(input)}
        submitting={create.isPending}
        canCreate={canCreate}
        used={used}
        maxSolo={maxSolo}
      />
    </div>
  );
}

function SoloCard({ g }: { g: Awaited<ReturnType<typeof listMySoloGroups>>[number] }) {
  const isProject = g.solo_mode === "project";
  const isLocked = isProject && g.solo_lock_until && new Date(g.solo_lock_until).getTime() > Date.now();
  const target = g.target_amount ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((g.total_saved / target) * 100)) : null;

  return (
    <Link to={`/solo/${g.id}`} className="block">
      <div className="rounded-lg border border-hairline bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{g.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {isProject ? <Target className="h-3.5 w-3.5" /> : <Wallet2 className="h-3.5 w-3.5" />}
              {isProject ? "Épargne Projet" : "Fonds de roulement"} · Épargne libre
            </p>
          </div>
          {isLocked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <Lock className="h-3 w-3" /> Bloqué
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
              <CheckCircle2 className="h-3 w-3" /> Retrait ouvert
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total épargné</span>
          <span className="font-display text-sm font-semibold text-foreground num">{formatGNF(g.total_saved)} GNF</span>
        </div>
        {target > 0 && (
          <>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Objectif</span>
              <span className="num">{formatGNF(target)} GNF</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct ?? 0}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {pct}%
              {g.solo_lock_until
                ? ` · échéance ${new Date(g.solo_lock_until).toLocaleDateString("fr-FR")}`
                : ""}
            </p>
          </>
        )}
      </div>
    </Link>
  );
}

function CreateSoloDialog({
  open, onOpenChange, onSubmit, submitting, canCreate, used, maxSolo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (input: {
    name: string; description?: string; category?: string;
    mode: SoloMode; targetAmount?: number | null; lockUntil?: string;
  }) => void;
  submitting: boolean;
  canCreate: boolean;
  used: number;
  maxSolo: number;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [mode, setMode] = useState<SoloMode>("project");
  const [targetAmount, setTargetAmount] = useState<string>("");
  const [lockUntil, setLockUntil] = useState<string>("");

  const minDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const amount = Number(targetAmount);

  /** Alertes temps réel évaluées à chaque frappe, avant toute soumission. */
  const alerts = useMemo(() => {
    const list: { level: "error" | "warn"; text: string }[] = [];
    if (!canCreate) {
      list.push({
        level: "error",
        text:
          maxSolo === 0
            ? "Votre plan actuel n'inclut pas la tontine Solo."
            : `Quota Solo atteint (${used}/${maxSolo}) pour votre plan.`,
      });
    }
    if (name.trim().length > 0 && name.trim().length < 3) {
      list.push({ level: "error", text: "Le nom doit contenir au moins 3 caractères." });
    }
    if (contribution !== "" && !(amount > 0)) {
      list.push({ level: "error", text: "La cotisation doit être supérieure à zéro." });
    }
    if (amount > 0 && amount % 1000 !== 0) {
      list.push({ level: "warn", text: "Cotisation inhabituelle : un multiple de 1 000 GNF est conseillé." });
    }
    if (mode === "project") {
      if (!lockUntil) {
        list.push({ level: "error", text: "Choisissez une date d'échéance pour l'épargne Projet." });
      } else if (new Date(lockUntil).getTime() <= Date.now()) {
        list.push({ level: "error", text: "La date d'échéance doit être dans le futur." });
      }
    }
    return list;
  }, [canCreate, maxSolo, used, name, contribution, amount, mode, lockUntil]);

  const blocking = alerts.some((a) => a.level === "error");

  /** Prévisualisation du groupe qui sera créé. */
  const preview = useMemo(() => {
    const perYear: Record<SoloFrequency, number> = {
      quotidienne: 365, hebdomadaire: 52, quinzaine: 26, mensuelle: 12,
    };
    const echeances =
      mode === "project" && lockUntil
        ? Math.max(
            0,
            Math.round(
              ((new Date(lockUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365)) *
                perYear[frequency],
            ),
          )
        : perYear[frequency];
    return {
      members: 1,
      international: false,
      targetStatus: "Active" as const,
      echeances,
      projected: (amount > 0 ? amount : 0) * echeances,
    };
  }, [mode, lockUntil, frequency, amount]);

  const canSubmit = !blocking && name.trim().length >= 3 && amount > 0 &&
    (mode === "working_capital" || lockUntil.length > 0);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      description: desc.trim() || undefined,
      mode,
      contribution: Number(contribution),
      frequency,
      lockUntil: mode === "project" ? new Date(lockUntil).toISOString() : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 shrink-0 text-primary" />
            <span className="min-w-0 truncate">Nouvelle tontine Solo</span>
          </DialogTitle>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("project")}
              className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                mode === "project" ? "border-primary bg-primary/5" : "border-hairline bg-card hover:bg-secondary"
              }`}
            >
              <p className="flex items-center gap-2 font-semibold"><Target className="h-4 w-4" /> Épargne Projet</p>
              <p className="mt-1 text-xs text-muted-foreground">Bloquée jusqu'à une date d'échéance.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("working_capital")}
              className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                mode === "working_capital" ? "border-primary bg-primary/5" : "border-hairline bg-card hover:bg-secondary"
              }`}
            >
              <p className="flex items-center gap-2 font-semibold"><Wallet2 className="h-4 w-4" /> Fonds de roulement</p>
              <p className="mt-1 text-xs text-muted-foreground">Retrait libre à tout moment.</p>
            </button>
          </div>

          <div>
            <Label htmlFor="solo-name">Nom</Label>
            <Input id="solo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Achat moto" />
          </div>
          <div>
            <Label htmlFor="solo-desc">Description (optionnel)</Label>
            <Textarea id="solo-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="solo-contrib">Cotisation (GNF)</Label>
              <Input
                id="solo-contrib" type="number" inputMode="numeric" min={1}
                value={contribution} onChange={(e) => setContribution(e.target.value)}
              />
            </div>
            <div>
              <Label>Fréquence</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as SoloFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quotidienne">Quotidienne</SelectItem>
                  <SelectItem value="hebdomadaire">Hebdomadaire</SelectItem>
                  <SelectItem value="quinzaine">Quinzaine</SelectItem>
                  <SelectItem value="mensuelle">Mensuelle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === "project" && (
            <div>
              <Label htmlFor="solo-until">Date d'échéance</Label>
              <Input
                id="solo-until" type="date" min={minDate}
                value={lockUntil} onChange={(e) => setLockUntil(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Aucun retrait ne sera possible avant cette date.
              </p>
            </div>
          )}

          <div className="rounded-md border border-hairline bg-secondary/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Info className="h-3.5 w-3.5" /> Prévisualisation
            </p>
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2 sm:gap-y-1.5">
              <dt className="text-muted-foreground">Membres</dt>
              <dd className="break-words font-medium sm:text-right">{preview.members} (organisateur unique)</dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="break-words font-medium sm:text-right">
                Solo · {mode === "project" ? "Projet" : "Fonds de roulement"} ·{" "}
                {preview.international ? "International" : "Privé"}
              </dd>
              <dt className="text-muted-foreground">Statut cible</dt>
              <dd className="break-words font-medium sm:text-right">{preview.targetStatus}</dd>
              <dt className="text-muted-foreground">Échéances estimées</dt>
              <dd className="break-words font-medium num sm:text-right">{preview.echeances}</dd>
              <dt className="text-muted-foreground">Épargne projetée</dt>
              <dd className="break-words font-medium num sm:text-right">{formatGNF(preview.projected)} GNF</dd>
            </dl>
          </div>

          {alerts.length > 0 && (
            <ul className="space-y-1.5" data-testid="solo-alerts">
              {alerts.map((a, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
                    a.level === "error"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-warning/10 text-warning-foreground"
                  }`}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
          )}

          {!canCreate && (
            <Button asChild variant="outline" className="w-full gap-2">
              <Link to="/abonnement"><Crown className="h-4 w-4" /> Voir les plans Premium & Business</Link>
            </Button>
          )}
        </div>
        <DialogFooter className="shrink-0 gap-2 sm:gap-2">
          <Button variant="ghost" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="w-full sm:w-auto" onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}