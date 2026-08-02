import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe2, Users, TrendingUp, Loader2, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  listInternationalGroups,
  getInternationalGroupMembers,
  applyToInternationalGroup,
  type InternationalGroup,
} from "@/lib/api/international";

function formatXof(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " XOF";
}

export default function International() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<InternationalGroup | null>(null);
  const [message, setMessage] = useState("");

  const { data: groups, isLoading } = useQuery({
    queryKey: ["international-groups"],
    queryFn: listInternationalGroups,
  });

  const { data: members } = useQuery({
    queryKey: ["international-members", selected?.group_id],
    queryFn: () => getInternationalGroupMembers(selected!.group_id),
    enabled: !!selected,
  });

  const applyMut = useMutation({
    mutationFn: () => applyToInternationalGroup(selected!.group_id, message.trim() || undefined),
    onSuccess: () => {
      toast.success("Candidature envoyée à l'organisateur.");
      setSelected(null);
      setMessage("");
      qc.invalidateQueries({ queryKey: ["international-groups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyAlerts: { level: "error" | "warn"; text: string }[] = [];
  if (selected) {
    if (selected.seats_left <= 0) {
      applyAlerts.push({ level: "error", text: "Ce groupe est complet : aucune place restante." });
    } else if (selected.seats_left === 1) {
      applyAlerts.push({ level: "warn", text: "Dernière place disponible : votre candidature peut être devancée." });
    }
    if (!["draft", "open"].includes(selected.status)) {
      applyAlerts.push({
        level: "warn",
        text: `Cycle déjà ${selected.status === "active" ? "démarré" : selected.status} : votre tour sera positionné en fin de rotation.`,
      });
    }
    if (selected.avg_reliability > 0 && selected.avg_reliability < 50) {
      applyAlerts.push({ level: "warn", text: "Score de fiabilité moyen faible sur ce groupe." });
    }
    if (message.trim().length > 500) {
      applyAlerts.push({ level: "error", text: "Le message ne peut pas dépasser 500 caractères." });
    }
  }
  const applyBlocked = applyAlerts.some((a) => a.level === "error");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Globe2 className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Tontines internationales</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Annuaire public de tontines ouvertes aux membres du monde entier.
          Les identités des participants sont anonymisées jusqu'à validation par l'organisateur.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !groups || groups.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Aucune tontine internationale ouverte pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.group_id} className="hover:shadow-md transition-shadow">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{g.name}</CardTitle>
                  <Badge variant={g.seats_left > 0 ? "default" : "secondary"}>
                    {g.seats_left > 0 ? `${g.seats_left} place(s)` : "Complet"}
                  </Badge>
                </div>
                {g.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{g.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Cotisation</p>
                    <p className="font-semibold">{formatXof(g.contribution_amount)}</p>
                    <p className="text-xs text-muted-foreground">{g.frequency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Membres</p>
                    <p className="font-semibold flex items-center gap-1">
                      <Users className="h-3 w-3" /> {g.current_members} / {g.max_members}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Score {Math.round(g.avg_reliability)}
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={g.seats_left === 0}
                  onClick={() => setSelected(g)}
                >
                  Voir & postuler
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              Membres anonymisés. Votre identité ne sera révélée qu'après acceptation de votre candidature.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Composition actuelle</p>
              <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border p-2">
                {members && members.length > 0 ? members.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1">
                    <span>{m.anon_label} <span className="text-xs text-muted-foreground">({m.role})</span></span>
                    <span className="text-xs text-muted-foreground">Score {Math.round(m.reliability_score)}</span>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground text-center py-2">Aucun membre actif.</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="msg" className="text-xs font-semibold uppercase text-muted-foreground">
                Message à l'organisateur (optionnel)
              </label>
              <Textarea
                id="msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Présentez-vous en quelques mots…"
                className="mt-1"
                rows={3}
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">{message.trim().length}/500</p>
            </div>

            {selected && (
              <div className="rounded-lg border bg-muted/40 p-3" data-testid="intl-preview">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  <Info className="h-3.5 w-3.5" /> Prévisualisation de votre adhésion
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Membres après validation</dt>
                  <dd className="text-right font-medium">
                    {Math.min(selected.current_members + 1, selected.max_members)} / {selected.max_members}
                  </dd>
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="text-right font-medium">Collective · Internationale</dd>
                  <dt className="text-muted-foreground">Statut du groupe</dt>
                  <dd className="text-right font-medium">{selected.status}</dd>
                  <dt className="text-muted-foreground">Statut cible</dt>
                  <dd className="text-right font-medium">En attente de validation</dd>
                  <dt className="text-muted-foreground">Cotisation</dt>
                  <dd className="text-right font-medium">{formatXof(selected.contribution_amount)} · {selected.frequency}</dd>
                </dl>
              </div>
            )}

            {applyAlerts.length > 0 && (
              <ul className="space-y-1.5" data-testid="intl-alerts">
                {applyAlerts.map((a, i) => (
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Annuler</Button>
            <Button onClick={() => applyMut.mutate()} disabled={applyMut.isPending || applyBlocked}>
              {applyMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Envoyer ma candidature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
