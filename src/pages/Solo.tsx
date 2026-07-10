import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PiggyBank, Plus, Target, Wallet2, Lock, CheckCircle2 } from "lucide-react";
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
import { createSoloGroup, listMySoloGroups, type SoloFrequency, type SoloMode } from "@/lib/api/solo";
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
      toast.success("Tontine Solo créée");
      qc.invalidateQueries({ queryKey: ["solo", "mine"] });
      qc.invalidateQueries({ queryKey: ["entitlements"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Création impossible", { description: e.message }),
  });

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="Tontines Solo" />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 lg:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Épargne Solo</h1>
            <p className="text-sm text-muted-foreground">
              Épargne personnelle : Épargne Projet (bloquée jusqu'à une date) ou Fonds de roulement (libre).
            </p>
          </div>
          <Button onClick={() => setOpen(true)} disabled={!canCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nouvelle
          </Button>
        </div>

        {!canCreate && (
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
          <div className="grid gap-4 md:grid-cols-2">
            {(listQ.data ?? []).map((g) => <SoloCard key={g.id} g={g} />)}
          </div>
        )}
      </main>

      <CreateSoloDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(input) => create.mutate(input)}
        submitting={create.isPending}
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
    <Link to={`/groupes/${g.id}`} className="block">
      <div className="rounded-lg border border-hairline bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{g.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {isProject ? <Target className="h-3.5 w-3.5" /> : <Wallet2 className="h-3.5 w-3.5" />}
              {isProject ? "Épargne Projet" : "Fonds de roulement"} · {g.frequency}
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
        {isProject && target > 0 && (
          <>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Objectif</span>
              <span className="num">{formatGNF(target)} GNF</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct ?? 0}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {pct}% · échéance {new Date(g.solo_lock_until!).toLocaleDateString("fr-FR")}
            </p>
          </>
        )}
      </div>
    </Link>
  );
}

function CreateSoloDialog({
  open, onOpenChange, onSubmit, submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (input: {
    name: string; description?: string; category?: string;
    mode: SoloMode; contribution: number; frequency: SoloFrequency; lockUntil?: string;
  }) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [mode, setMode] = useState<SoloMode>("project");
  const [contribution, setContribution] = useState<string>("");
  const [frequency, setFrequency] = useState<SoloFrequency>("mensuelle");
  const [lockUntil, setLockUntil] = useState<string>("");

  const minDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const canSubmit = name.trim().length > 0 && Number(contribution) > 0 &&
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-primary" /> Nouvelle tontine Solo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
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

          <div className="grid grid-cols-2 gap-3">
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}