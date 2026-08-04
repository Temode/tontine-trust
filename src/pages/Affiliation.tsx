import { useQuery } from "@tanstack/react-query";
import { Copy, Loader2, Share2, TrendingUp, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMyAffiliateSummary, listMyAffiliateEarnings } from "@/lib/api/business";

function xof(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " XOF";
}

export default function Affiliation() {
  const { data: summary, isLoading: sLoading } = useQuery({
    queryKey: ["affiliate-summary"],
    queryFn: getMyAffiliateSummary,
  });
  const { data: earnings } = useQuery({
    queryKey: ["affiliate-earnings"],
    queryFn: listMyAffiliateEarnings,
  });

  const refLink = summary?.referral_code
    ? `${window.location.origin}/?ref=${summary.referral_code}`
    : "";

  const copyLink = async () => {
    if (!refLink) return;
    await navigator.clipboard.writeText(refLink);
    toast.success("Lien copié");
  };

  const share = async () => {
    if (!refLink) return;
    if (navigator.share) {
      await navigator.share({ title: "Tontine Digital", text: "Rejoins-moi", url: refLink });
    } else {
      copyLink();
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Programme d'affiliation</h1>
        <p className="text-sm text-muted-foreground">
          Partagez votre lien et gagnez une commission à chaque abonnement de vos filleuls.
        </p>
      </header>

      {sLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : summary && (
        <>
          <Card>
            <CardHeader><CardTitle>Votre lien de parrainage</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-muted p-3 font-mono text-sm break-all">
                {refLink || "—"}
              </div>
              <div className="flex gap-2">
                <Button onClick={copyLink} variant="outline" className="flex-1">
                  <Copy className="h-4 w-4 mr-2" /> Copier
                </Button>
                <Button onClick={share} className="flex-1">
                  <Share2 className="h-4 w-4 mr-2" /> Partager
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Code: <span className="font-mono font-semibold">{summary.referral_code}</span>
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-4">
            <StatCard icon={<Users className="h-4 w-4" />} label="Filleuls" value={summary.referrals_count.toString()} />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Actifs" value={summary.active_count.toString()} />
            <StatCard icon={<Wallet className="h-4 w-4" />} label="En attente" value={xof(summary.pending)} />
            <StatCard icon={<Wallet className="h-4 w-4" />} label="Payé" value={xof(summary.paid)} />
          </div>
        </>
      )}

      <Card>
        <CardHeader><CardTitle>Historique des gains</CardTitle></CardHeader>
        <CardContent>
          {!earnings || earnings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun gain pour l'instant.</p>
          ) : (
            <div className="divide-y">
              {earnings.map(e => (
                <div key={e.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{e.referred_full_name ?? "Filleul"}</p>
                    <p className="text-xs text-muted-foreground">{e.period} · {new Date(e.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{xof(e.amount)}</span>
                    <Badge variant={e.paid ? "default" : "secondary"}>{e.paid ? "Payé" : "En attente"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon} {label}</div>
        <p className="mt-1 text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
