import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

interface Stats {
  by_status: Record<string, number>;
  by_kind: { kind: string; status: string; count: number }[];
  pending_now: number;
  recent_errors: {
    id: string;
    kind: string;
    attempts: number;
    error: string;
    retryable: boolean;
    created_at: string;
  }[];
}

const STATUS_LABEL: Record<string, string> = {
  sent: "Envoyés",
  queued: "En attente",
  processing: "En cours",
  failed: "Échecs",
};

export default function AdminEmailOutbox() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-email-outbox"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_email_outbox_stats", { _hours: 24 } as never);
      if (error) throw error;
      return data as unknown as Stats;
    },
    refetchInterval: 30_000,
  });

  const retry = useMutation({
    mutationFn: async (id?: string) => {
      const { data, error } = await supabase.rpc("admin_email_outbox_retry", {
        _id: id ?? null,
      } as never);
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: (n) => {
      toast.success(`${n} email(s) remis en file`);
      qc.invalidateQueries({ queryKey: ["admin-email-outbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const byStatus = data?.by_status ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">File d'envoi des emails</h1>
          <p className="text-sm text-muted-foreground">
            Suivi des emails de notification et d'alerte (24 dernières heures).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => retry.mutate(undefined)}
          disabled={retry.isPending}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Rejouer tous les échecs
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {["sent", "queued", "processing", "failed"].map((s) => (
          <Card key={s}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                {STATUS_LABEL[s]}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{byStatus[s] ?? 0}</CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              En file (total)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data?.pending_now ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Répartition par type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {(data?.by_kind ?? []).map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm border-b py-1.5 last:border-0">
              <span className="font-medium">{r.kind}</span>
              <span className="flex items-center gap-2">
                <Badge variant={r.status === "failed" ? "destructive" : "secondary"}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
                <span className="tabular-nums">{r.count}</span>
              </span>
            </div>
          ))}
          {!isLoading && (data?.by_kind ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun envoi sur la période.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dernières erreurs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.recent_errors ?? []).map((e) => (
            <div key={e.id} className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive">{e.kind}</Badge>
                <span className="text-muted-foreground">{e.attempts} tentative(s)</span>
                <Badge variant={e.retryable ? "secondary" : "outline"}>
                  {e.retryable ? "Réessayable" : "Définitif"}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {new Date(e.created_at).toLocaleString("fr-FR")}
                </span>
                {e.retryable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => retry.mutate(e.id)}
                    disabled={retry.isPending}
                  >
                    Rejouer
                  </Button>
                )}
              </div>
              <p className="text-xs break-words text-muted-foreground">{e.error}</p>
            </div>
          ))}
          {(data?.recent_errors ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune erreur en attente.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
