import { useQuery } from "@tanstack/react-query";
import { Briefcase, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMyCoordinatorCommissions } from "@/lib/api/business";

function xof(n: number) { return new Intl.NumberFormat("fr-FR").format(n) + " XOF"; }

export default function CoordinatorCommissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["coordinator-commissions"],
    queryFn: listMyCoordinatorCommissions,
  });

  const total = (data ?? []).reduce((s, c) => s + c.amount, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <header className="flex items-center gap-2">
        <Briefcase className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold">Mes commissions coordinateur</h1>
          <p className="text-sm text-muted-foreground">
            Commissions prélevées automatiquement sur chaque versement dans vos tontines Business.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle>Total perçu</CardTitle></CardHeader>
        <CardContent><p className="text-3xl font-bold">{xof(total)}</p></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Détail</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune commission encore.</p>
          ) : (
            <div className="divide-y">
              {data.map(c => (
                <div key={c.entry_id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{c.group_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.memo ?? "Commission"} · {new Date(c.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className="font-semibold">{xof(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
