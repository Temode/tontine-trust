import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, KeyRound, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProbeResult {
  ok: boolean;
  authUrl: string;
  status: number;
  latencyMs: number;
  response: unknown;
  tokenPreview: string | null;
  expiresIn: number | null;
  networkError?: string;
}

interface Diagnostics {
  activeEnv: "prod" | "sandbox";
  clientIdPreview: string;
  clientIdLength: number;
  clientIdTrimmedLength: number;
  clientIdHasWhitespace: boolean;
  clientSecretLength: number;
  clientSecretTrimmedLength: number;
  clientSecretHasWhitespace: boolean;
}

type Verdict =
  | "BOTH_OK"
  | "OK_PROD"
  | "OK_SANDBOX"
  | "WRONG_ENV_SHOULD_BE_PROD"
  | "WRONG_ENV_SHOULD_BE_SANDBOX"
  | "WHITESPACE_IN_SECRETS"
  | "BOTH_FAILED";

interface ValidationResult {
  ok: boolean;
  verdict?: Verdict;
  diagnostics?: Diagnostics;
  results?: { prod: ProbeResult; sandbox: ProbeResult };
  // erreurs précoces
  error?: string;
  message?: string;
  detail?: string;
  env?: string;
}

const VERDICT_COPY: Record<Verdict, { tone: "ok" | "warn" | "error"; title: string; advice: string }> = {
  BOTH_OK: {
    tone: "ok",
    title: "Les deux environnements acceptent ces clés",
    advice: "Cas inhabituel — vérifie que tu utilises bien des clés Production pour la prod.",
  },
  OK_PROD: {
    tone: "ok",
    title: "Production OK ✅",
    advice: "Tu es prêt à encaisser en réel.",
  },
  OK_SANDBOX: {
    tone: "ok",
    title: "Sandbox OK ✅",
    advice: "Tu es bien configuré pour tester. Bascule DJOMY_ENV=prod quand tu auras des clés Production valides.",
  },
  WRONG_ENV_SHOULD_BE_PROD: {
    tone: "warn",
    title: "Tes clés sont des clés Production, mais DJOMY_ENV = sandbox",
    advice: "Mets à jour le secret DJOMY_ENV à la valeur `prod`.",
  },
  WRONG_ENV_SHOULD_BE_SANDBOX: {
    tone: "warn",
    title: "Tes clés sont des clés Sandbox, alors que DJOMY_ENV = prod",
    advice:
      "Soit bascule DJOMY_ENV à `sandbox`, soit récupère des clés Production dans l'espace marchand Djomy puis recolle-les.",
  },
  WHITESPACE_IN_SECRETS: {
    tone: "error",
    title: "Un secret contient des espaces ou retours à la ligne",
    advice:
      "Mets à jour DJOMY_CLIENT_ID / DJOMY_CLIENT_SECRET en recollant les valeurs sans espace ni saut de ligne.",
  },
  BOTH_FAILED: {
    tone: "error",
    title: "Djomy refuse ces identifiants sur les deux environnements",
    advice:
      "Vérifie dans ton espace marchand que les clés sont bien actives, puis contacte le support Djomy avec le Client ID affiché.",
  },
};

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
      const r = data as ValidationResult;
      setResult(r);
      if (r.ok) toast.success("Identifiants Djomy valides ✅");
      else toast.error("Diagnostic Djomy", { description: r.verdict ?? r.error ?? "ÉCHEC" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erreur de validation", { description: msg });
      setResult({ ok: false, error: "INVOKE_FAILED", detail: msg });
    } finally {
      setLoading(false);
    }
  };

  const renderProbe = (label: string, p: ProbeResult, isActive: boolean) => (
    <div
      className={`rounded-md border p-3 text-xs ${
        p.ok
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-red-500/30 bg-red-500/5"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-slate-100">
          {p.ok ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400" />
          )}
          {label}
          {isActive && (
            <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
              actif
            </span>
          )}
        </div>
        <span className="font-mono text-slate-400">
          HTTP {p.status || "—"} · {p.latencyMs}ms
        </span>
      </div>
      <div className="mt-2 font-mono break-all text-[11px] text-slate-400">{p.authUrl}</div>
      {p.tokenPreview && (
        <div className="mt-1 text-[11px] text-emerald-300">Bearer : <span className="font-mono">{p.tokenPreview}</span></div>
      )}
      {p.networkError && (
        <div className="mt-1 text-[11px] text-red-300">Erreur réseau : {p.networkError}</div>
      )}
      {p.response !== undefined && p.response !== null && (
        <details className="mt-2">
          <summary className="cursor-pointer text-slate-400">Réponse brute</summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-950/60 p-2 text-[10px] text-slate-300">
{JSON.stringify(p.response, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-xl font-semibold text-amber-300 flex items-center gap-2">
          <KeyRound className="h-5 w-5" /> Identifiants Djomy
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Teste les clés API Djomy en simultané sur Production et Sandbox pour identifier précisément la cause d'un refus.
        </p>
      </header>

      <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-slate-100">Validation immédiate</h2>
            <p className="text-xs text-slate-400 mt-1">
              Appelle <code className="text-amber-300">POST /v1/auth</code> sur <strong>prod-api</strong> et{" "}
              <strong>sandbox-api</strong> simultanément.
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

        {result && result.verdict && result.diagnostics && result.results && (() => {
          const v = VERDICT_COPY[result.verdict!];
          const toneClass =
            v.tone === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
              : v.tone === "warn"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                : "border-red-500/40 bg-red-500/10 text-red-100";
          const d = result.diagnostics!;
          return (
            <div className="space-y-3">
              <div className={`rounded-md border p-4 text-sm ${toneClass}`}>
                <div className="flex items-center gap-2 font-medium">
                  {v.tone === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {v.title}
                </div>
                <p className="mt-1 text-xs opacity-90">{v.advice}</p>
              </div>

              <dl className="grid grid-cols-[160px_1fr] gap-y-1 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
                <dt className="text-slate-500">DJOMY_ENV actif</dt>
                <dd className="font-mono">{d.activeEnv}</dd>
                <dt className="text-slate-500">Client ID</dt>
                <dd className="font-mono">{d.clientIdPreview} ({d.clientIdLength} car.)</dd>
                <dt className="text-slate-500">Secret</dt>
                <dd className="font-mono">{d.clientSecretLength} caractères</dd>
                {d.clientIdHasWhitespace && (
                  <>
                    <dt className="text-red-400">⚠ Client ID</dt>
                    <dd className="text-red-300">contient un espace ou un saut de ligne</dd>
                  </>
                )}
                {d.clientSecretHasWhitespace && (
                  <>
                    <dt className="text-red-400">⚠ Secret</dt>
                    <dd className="text-red-300">contient un espace ou un saut de ligne</dd>
                  </>
                )}
              </dl>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {renderProbe("Production", result.results!.prod, d.activeEnv === "prod")}
                {renderProbe("Sandbox", result.results!.sandbox, d.activeEnv === "sandbox")}
              </div>
            </div>
          );
        })()}

        {result && !result.verdict && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
            <div className="flex items-center gap-2 font-medium">
              <XCircle className="h-4 w-4" />
              Échec : {result.error ?? "ERREUR"}
            </div>
            {result.message && <p className="mt-1 text-xs">{result.message}</p>}
            {result.detail && <p className="mt-1 font-mono text-xs break-all">{result.detail}</p>}
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
          <code className="text-amber-300">DJOMY_ENV</code> (<code>sandbox</code> ou <code>production</code>).
        </p>
      </section>
    </div>
  );
}