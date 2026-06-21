import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, KeyRound, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ValidationResult {
  ok: boolean;
  env?: string;
  authUrl?: string;
  status?: number;
  latencyMs?: number;
  clientIdPreview?: string;
  clientSecretLength?: number;
  tokenPreview?: string | null;
  expiresIn?: number | null;
  response?: unknown;
  error?: string;
  message?: string;
  detail?: string;
}

export default function DjomySettings() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const runValidation = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("djomy-validate-credentials", {
        method: "POST",
      });
      if (error) throw error;
      setResult(data as ValidationResult);
      if ((data as ValidationResult).ok) toast.success("Identifiants Djomy valides ✅");
      else toast.error("Identifiants Djomy invalides", { description: (data as ValidationResult).error });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erreur de validation", { description: msg });
      setResult({ ok: false, error: "INVOKE_FAILED", detail: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-xl font-semibold text-amber-300 flex items-center gap-2">
          <KeyRound className="h-5 w-5" /> Identifiants Djomy
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Vérifier que les clés API Djomy stockées côté serveur sont acceptées par l'environnement actif.
        </p>
      </header>

      <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-slate-100">Validation immédiate</h2>
            <p className="text-xs text-slate-400 mt-1">
              Appelle <code className="text-amber-300">POST /v1/auth</code> chez Djomy avec les secrets actuels.
            </p>
          </div>
          <Button
            onClick={runValidation}
            disabled={loading}
            className="bg-amber-400 text-slate-900 hover:bg-amber-300"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Tester maintenant
          </Button>
        </div>

        {result && (
          <div
            className={`rounded-md border p-4 text-sm ${
              result.ok
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                : "border-red-500/30 bg-red-500/5 text-red-200"
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {result.ok ? "Identifiants acceptés par Djomy" : `Échec : ${result.error ?? "ERREUR"}`}
            </div>
            <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-1 text-xs text-slate-300">
              {result.env && (<><dt className="text-slate-500">Environnement</dt><dd className="font-mono">{result.env}</dd></>)}
              {result.authUrl && (<><dt className="text-slate-500">URL auth</dt><dd className="font-mono break-all">{result.authUrl}</dd></>)}
              {typeof result.status === "number" && (<><dt className="text-slate-500">HTTP status</dt><dd className="font-mono">{result.status}</dd></>)}
              {typeof result.latencyMs === "number" && (<><dt className="text-slate-500">Latence</dt><dd className="font-mono">{result.latencyMs} ms</dd></>)}
              {result.clientIdPreview && (<><dt className="text-slate-500">Client ID</dt><dd className="font-mono">{result.clientIdPreview}</dd></>)}
              {typeof result.clientSecretLength === "number" && (<><dt className="text-slate-500">Secret</dt><dd className="font-mono">{result.clientSecretLength} caractères</dd></>)}
              {result.tokenPreview && (<><dt className="text-slate-500">Bearer</dt><dd className="font-mono">{result.tokenPreview}</dd></>)}
              {typeof result.expiresIn === "number" && (<><dt className="text-slate-500">Expire dans</dt><dd className="font-mono">{result.expiresIn}s</dd></>)}
              {result.message && (<><dt className="text-slate-500">Message</dt><dd>{result.message}</dd></>)}
              {result.detail && (<><dt className="text-slate-500">Détail</dt><dd className="font-mono break-all">{result.detail}</dd></>)}
            </dl>
            {result.response !== undefined && result.response !== null && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-400">Réponse brute Djomy</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-950/60 p-3 text-[11px] text-slate-300">
{JSON.stringify(result.response, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-3">
        <h2 className="font-medium text-slate-100">Mettre à jour les identifiants</h2>
        <p className="text-sm text-slate-300">
          Les secrets <code className="text-amber-300">DJOMY_CLIENT_ID</code> et{" "}
          <code className="text-amber-300">DJOMY_CLIENT_SECRET</code> sont stockés côté serveur (jamais dans le code).
          Pour les changer en quelques secondes :
        </p>
        <ol className="list-decimal list-inside text-sm text-slate-300 space-y-1">
          <li>
            Dans le chat Lovable, écris :{" "}
            <code className="text-amber-300">« Mets à jour DJOMY_CLIENT_ID et DJOMY_CLIENT_SECRET »</code>
          </li>
          <li>Un formulaire sécurisé s'ouvre — colle les nouvelles valeurs.</li>
          <li>Reviens ici et clique <strong>Tester maintenant</strong> pour valider immédiatement.</li>
        </ol>
        <p className="text-xs text-slate-500">
          Pour basculer entre sandbox et production, demande aussi la mise à jour du secret{" "}
          <code className="text-amber-300">DJOMY_ENV</code> (<code>sandbox</code> ou <code>prod</code>).
        </p>
      </section>
    </div>
  );
}