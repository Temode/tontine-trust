import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { adminPublishContractTemplate, listPlatformTemplates } from "@/lib/api/contracts";

export default function AdminContractTemplate() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["platform-contracts"], queryFn: listPlatformTemplates });
  const [version, setVersion] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (q.data && q.data[0] && !body) {
      setBody(q.data[0].body_md);
      setVersion(suggestNext(q.data[0].version));
    }
  }, [q.data, body]);

  const pub = useMutation({
    mutationFn: () => adminPublishContractTemplate(version.trim(), body.trim()),
    onSuccess: () => {
      toast.success("Nouvelle version publiée");
      qc.invalidateQueries({ queryKey: ["platform-contracts"] });
    },
    onError: (e) => toast.error("Publication impossible", { description: (e as Error).message }),
  });

  return (
    <div className="p-6">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-bold">Contrat numérique — modèle plateforme</h1>
        <p className="text-sm text-muted-foreground">
          Cette version est utilisée par défaut pour tous les groupes qui n'ont pas surchargé leur propre texte.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Versions publiées</h2>
          {q.isLoading && <Loader2 className="mt-3 h-4 w-4 animate-spin text-muted-foreground" />}
          <ul className="mt-3 space-y-2">
            {(q.data ?? []).map((c) => (
              <li key={c.contract_id} className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-sm">
                <div>
                  <div className="font-semibold">v{c.version}</div>
                  <div className="text-xs text-muted-foreground">{new Date(c.published_at).toLocaleString("fr-FR")}</div>
                </div>
                {c.is_default && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <ShieldCheck className="h-3 w-3" /> Par défaut
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Publier une nouvelle version</h2>
          <label className="mt-3 block text-xs font-semibold uppercase text-muted-foreground">Version</label>
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="ex. 1.1"
            className="mt-1 h-10 w-32 rounded-md border border-border bg-background px-3 text-sm" />
          <label className="mt-3 block text-xs font-semibold uppercase text-muted-foreground">Texte (Markdown, ≥ 50 caractères)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={18}
            className="mt-1 w-full rounded-md border border-border bg-background p-3 font-mono text-xs"
            placeholder="# Contrat..." />
          <button type="button" disabled={pub.isPending || body.trim().length < 50 || version.trim().length === 0}
            onClick={() => pub.mutate()}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {pub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publier comme version par défaut
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">La nouvelle version devient immédiatement le contrat par défaut pour les nouveaux groupes et toute adhésion future.</p>
        </div>
      </section>
    </div>
  );
}

function suggestNext(v: string): string {
  const m = v.match(/^(\d+)\.(\d+)$/);
  if (!m) return v + ".1";
  return `${m[1]}.${Number(m[2]) + 1}`;
}