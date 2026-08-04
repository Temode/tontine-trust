import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  adminListReferrals, adminListReferralEarnings, adminMarkEarningPaid, adminSetReferralStatus,
  auditCoordinatorCommissions, auditReferralEarnings,
  type AdminReferralRow, type AdminEarningRow,
} from "@/lib/api/business";

function xof(n: number) { return new Intl.NumberFormat("fr-FR").format(n) + " XOF"; }

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function AffiliationAdmin() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [earnFilter, setEarnFilter] = useState<string>("all");

  const referrals = useQuery({
    queryKey: ["admin-referrals", status, search],
    queryFn: () => adminListReferrals(status === "all" ? undefined : status, search || undefined),
  });

  const earnings = useQuery({
    queryKey: ["admin-earnings", earnFilter],
    queryFn: () => adminListReferralEarnings(
      earnFilter === "all" ? undefined : earnFilter === "paid",
    ),
  });

  const auditCoord = useQuery({ queryKey: ["audit-coord"], queryFn: auditCoordinatorCommissions });
  const auditRef = useQuery({ queryKey: ["audit-ref"], queryFn: auditReferralEarnings });

  const markPaid = useMutation({
    mutationFn: (v: { id: string; paid: boolean }) => adminMarkEarningPaid(v.id, v.paid),
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-earnings"] });
      qc.invalidateQueries({ queryKey: ["admin-referrals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRefStatus = useMutation({
    mutationFn: (v: { id: string; status: "pending"|"active"|"expired"|"revoked" }) =>
      adminSetReferralStatus(v.id, v.status),
    onSuccess: () => {
      toast.success("Statut affilié mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-referrals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalIssues = (auditCoord.data?.length ?? 0) + (auditRef.data?.length ?? 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Affiliation & Commissions</h1>
        <p className="text-sm text-slate-400">Supervision des parrainages, gains et contrôles d'intégrité.</p>
      </header>

      <Card className="border-amber-500/40 bg-slate-900">
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-amber-400" /> Contrôles d'intégrité
          </CardTitle>
          <Badge variant={totalIssues > 0 ? "destructive" : "default"}>
            {totalIssues} anomalie{totalIssues > 1 ? "s" : ""}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <IntegrityBlock title="Commissions coordinateur" issues={auditCoord.data ?? []} loading={auditCoord.isLoading} />
          <IntegrityBlock title="Gains d'affiliation" issues={auditRef.data ?? []} loading={auditRef.isLoading} />
        </CardContent>
      </Card>

      <Tabs defaultValue="referrals">
        <TabsList>
          <TabsTrigger value="referrals">Affiliés</TabsTrigger>
          <TabsTrigger value="earnings">Gains</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40 bg-slate-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="expired">Expiré</SelectItem>
                <SelectItem value="revoked">Révoqué</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (nom, code)"
              className="w-64 bg-slate-900"
            />
            <Button
              variant="outline"
              onClick={() => download(`referrals-${Date.now()}.csv`, toCSV((referrals.data ?? []) as unknown as Record<string, unknown>[]))}
              disabled={!referrals.data?.length}
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>

          {referrals.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !referrals.data?.length ? (
            <p className="text-sm text-slate-400 py-6 text-center">Aucun affilié trouvé.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-xs text-slate-400">
                  <tr>
                    <th className="p-3 text-left">Parrain</th>
                    <th className="p-3 text-left">Code</th>
                    <th className="p-3 text-left">Filleul</th>
                    <th className="p-3 text-left">Statut</th>
                    <th className="p-3 text-right">%</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">En attente</th>
                    <th className="p-3 text-right">Payé</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {referrals.data.map((r: AdminReferralRow) => (
                    <tr key={r.id}>
                      <td className="p-3">{r.referrer_name ?? "—"}</td>
                      <td className="p-3 font-mono text-xs">{r.referrer_code ?? "—"}</td>
                      <td className="p-3">{r.referred_name ?? "—"}</td>
                      <td className="p-3"><Badge>{r.status}</Badge></td>
                      <td className="p-3 text-right">{r.commission_percent}%</td>
                      <td className="p-3 text-right">{xof(r.total_earned)}</td>
                      <td className="p-3 text-right">{xof(r.pending_amount)}</td>
                      <td className="p-3 text-right">{xof(r.paid_amount)}</td>
                      <td className="p-3 text-right">
                        <Select
                          value={r.status}
                          onValueChange={(v) => setRefStatus.mutate({ id: r.id, status: v as "pending"|"active"|"expired"|"revoked" })}
                        >
                          <SelectTrigger className="h-8 w-32 bg-slate-900"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">pending</SelectItem>
                            <SelectItem value="active">active</SelectItem>
                            <SelectItem value="expired">expired</SelectItem>
                            <SelectItem value="revoked">revoked</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="earnings" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={earnFilter} onValueChange={setEarnFilter}>
              <SelectTrigger className="w-40 bg-slate-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="paid">Payés</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => download(`earnings-${Date.now()}.csv`, toCSV((earnings.data ?? []) as unknown as Record<string, unknown>[]))}
              disabled={!earnings.data?.length}
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>

          {earnings.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !earnings.data?.length ? (
            <p className="text-sm text-slate-400 py-6 text-center">Aucun gain.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-xs text-slate-400">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Période</th>
                    <th className="p-3 text-left">Parrain</th>
                    <th className="p-3 text-left">Filleul</th>
                    <th className="p-3 text-right">Montant</th>
                    <th className="p-3 text-left">Statut</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {earnings.data.map((e: AdminEarningRow) => (
                    <tr key={e.id}>
                      <td className="p-3">{new Date(e.created_at).toLocaleDateString("fr-FR")}</td>
                      <td className="p-3">{e.period}</td>
                      <td className="p-3">{e.referrer_name ?? "—"}</td>
                      <td className="p-3">{e.referred_name ?? "—"}</td>
                      <td className="p-3 text-right">{xof(e.amount)}</td>
                      <td className="p-3">
                        <Badge variant={e.paid ? "default" : "secondary"}>
                          {e.paid ? "payé" : "en attente"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant={e.paid ? "outline" : "default"}
                          onClick={() => markPaid.mutate({ id: e.id, paid: !e.paid })}
                        >
                          {e.paid ? "Marquer non payé" : "Marquer payé"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IntegrityBlock({ title, issues, loading }: { title: string; issues: { issue: string }[]; loading: boolean }) {
  const grouped = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of issues) m.set(it.issue, (m.get(it.issue) ?? 0) + 1);
    return Array.from(m.entries());
  }, [issues]);
  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <p className="text-xs font-semibold uppercase text-slate-400 mb-2">{title}</p>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> :
        issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Aucun écart détecté
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {grouped.map(([issue, count]) => (
              <li key={issue} className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-3 w-3" /> {issue} <span className="text-slate-400">×{count}</span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
