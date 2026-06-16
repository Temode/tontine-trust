import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminQueue, adminDecideDeletion } from "@/lib/api/deletion";

export default function AdminDeletionRequests() {
  const { roles, loading } = useAuth();
  const qc = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const isSuper = roles.includes("super_admin" as never);

  const q = useQuery({
    queryKey: ["admin-deletion-queue"],
    queryFn: listAdminQueue,
    enabled: isSuper,
  });

  const decideM = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      adminDecideDeletion(id, approve, reason),
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Suppression approuvée" : "Demande refusée");
      qc.invalidateQueries({ queryKey: ["admin-deletion-queue"] });
    },
    onError: (e: Error) => toast.error("Impossible", { description: e.message }),
  });

  if (loading) return null;
  if (!isSuper) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Accès réservé</h1>
        <p className="text-muted-foreground">Réservé aux administrateurs Tontine.</p>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Demandes de suppression" subtitle="File d'attente Tontine — décisions finales" />
      <div className="p-6 space-y-4 max-w-4xl">
        {q.isLoading && <p>Chargement…</p>}
        {q.data?.length === 0 && (
          <p className="text-muted-foreground">Aucune demande en attente.</p>
        )}
        {q.data?.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle>{r.group_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p><strong>Organisateur :</strong> {r.requester_name ?? "—"}</p>
              <p><strong>Motif :</strong> {r.reason}</p>
              <p>
                Votes : <strong>{r.yes_votes}</strong> approbations · <strong>{r.no_votes}</strong> refus
                · {r.active_members} membres actifs
              </p>
              <p className="text-muted-foreground">
                Cotisation {r.contribution_amount} · {r.frequency} · {r.max_members} membres max
              </p>
              <Textarea
                placeholder="Motif de décision (optionnel)"
                value={reasons[r.id] ?? ""}
                onChange={(e) => setReasons((s) => ({ ...s, [r.id]: e.target.value }))}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => decideM.mutate({ id: r.id, approve: true, reason: reasons[r.id] })}
                  disabled={decideM.isPending}
                >
                  Approuver la suppression
                </Button>
                <Button
                  variant="outline"
                  onClick={() => decideM.mutate({ id: r.id, approve: false, reason: reasons[r.id] })}
                  disabled={decideM.isPending}
                >
                  Refuser
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}