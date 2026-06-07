import { useEffect, useState } from "react";
import { ArrowRight, ClipboardPaste, Loader2, ShieldCheck, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { joinWithCodeAndStatus } from "@/lib/api/invitations";
import { JoinFlow, type JoinFlowResult } from "@/components/join-group/JoinFlow";

type LookupState = "idle" | "checking" | "error";

interface CodeEntryHeroProps {
  onMatch?: (group: unknown) => void;
  onClear?: () => void;
  matchedCode?: string;
}

/**
 * Auto-format an input string into the canonical TD-XXXX-XXXX shape.
 * Strips anything outside [A-Z0-9] and reinjects the prefix + dashes.
 */
function autoFormat(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const trimmed = cleaned.startsWith("TD") ? cleaned.slice(2) : cleaned;
  const part1 = trimmed.slice(0, 4);
  const part2 = trimmed.slice(4, 8);
  if (!part1) return "";
  if (!part2) return `TD-${part1}`;
  return `TD-${part1}-${part2}`;
}

function isComplete(code: string): boolean {
  return /^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}

export function CodeEntryHero({ onMatch, onClear, matchedCode }: CodeEntryHeroProps) {
  void matchedCode; void onMatch; void onClear;
  const [code, setCode] = useState("");
  const [state, setState] = useState<LookupState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  /** Opens the consent gate. Actual network call happens in performJoin. */
  const handleJoin = () => {
    if (!isComplete(code)) return;
    setErrorMsg(null);
    setConfirmOpen(true);
  };

  const performJoin = async (payload: JoinFlowResult) => {
    if (!isComplete(code)) return;
    setState("checking");
    setErrorMsg(null);
    try {
      const { groupId, status } = await joinWithCodeAndStatus(code, {
        operator: payload.operator,
        message: payload.message,
      });
      await qc.invalidateQueries({ queryKey: ["groups", "mine"] });
      await qc.invalidateQueries({ queryKey: ["my-groups"] });
      setConfirmOpen(false);
      setState("idle");
      if (status === "pending") {
        toast.success("Demande envoyée", {
          description: "L'organisateur doit valider votre adhésion. Vous serez notifié.",
        });
        navigate("/groupes");
      } else {
        toast.success("Adhésion confirmée", { description: "Vous avez rejoint le groupe." });
        navigate(`/groupes/${groupId}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setErrorMsg(msg);
      setState("error");
      setConfirmOpen(false);
      toast.error("Adhésion impossible", { description: msg });
    }
  };

  // Pré‑remplissage depuis l'URL (?code=TD-XXXX-XXXX). Aucune adhésion
  // automatique : l'utilisateur doit explicitement confirmer.
  useEffect(() => {
    const raw = searchParams.get("code");
    if (!raw || code) return;
    const formatted = autoFormat(raw);
    setCode(formatted);
    // Retire le paramètre de l'URL après lecture
    const next = new URLSearchParams(searchParams);
    next.delete("code");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, code]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setCode(autoFormat(text));
    } catch {
      /* clipboard rejected */
    }
  };

  const handleClear = () => {
    setCode("");
    setState("idle");
    setErrorMsg(null);
  };

  return (
    <article className="relative overflow-hidden rounded-xl border border-hairline bg-card">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary-50 blur-3xl" />
      </div>

      <div className="relative grid grid-cols-1 gap-6 px-5 py-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10 lg:px-8 lg:py-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Souscription par code
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-foreground lg:text-3xl">
            Saisissez votre code d'invitation
          </h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Format <span className="font-mono">TD-XXXX-XXXX</span>. Le code est unique à chaque groupe et
            ne peut être utilisé que par les personnes invitées par l'organisateur.
          </p>

          <div className="mt-6">
            <div
              className={cn(
                "flex items-stretch rounded-lg border bg-card transition",
                state === "error" && "border-destructive/40 ring-2 ring-destructive/15",
                state === "idle" && "border-hairline focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15",
                state === "checking" && "border-primary/40",
              )}
            >
              <input
                aria-label="Code d'invitation"
                inputMode="text"
                spellCheck={false}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="TD-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(autoFormat(e.target.value))}
                onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
                maxLength={12}
                className="h-14 w-full bg-transparent px-4 font-mono text-xl font-bold tracking-[0.18em] text-foreground placeholder:text-muted-foreground/60 focus:outline-none num"
              />

              <div className="flex items-center gap-1 pr-2">
                {code && (
                  <button
                    type="button"
                    onClick={handleClear}
                    aria-label="Effacer le code"
                    className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePaste}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Coller
                </button>
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={!isComplete(code) || state === "checking"}
                  className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-50"
                >
                  {state === "checking" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  Rejoindre
                </button>
              </div>
            </div>

            <StateLine state={state} errorMsg={errorMsg} />
          </div>
        </div>

        <aside className="rounded-lg border border-hairline bg-secondary/40 p-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Sécurité
          </p>
          <ul className="mt-3 space-y-2.5 text-sm">
            <Bullet>Chaque code est unique au groupe et tracé dans le registre.</Bullet>
            <Bullet>Une seule adhésion par compte et par cycle.</Bullet>
            <Bullet>Le code expire automatiquement à la complétion du groupe.</Bullet>
            <Bullet>L'organisateur peut révoquer un code à tout moment.</Bullet>
          </ul>
          <p className="mt-4 inline-flex items-start gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <span>Aucun débit n'est exécuté avant la confirmation explicite de votre adhésion.</span>
          </p>
        </aside>
      </div>

      <JoinFlow
        mode="code"
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o && state === "checking") setState("idle");
        }}
        code={code}
        submitting={state === "checking"}
        onConfirm={performJoin}
      />
    </article>
  );
}

function StateLine({ state, errorMsg }: { state: LookupState; errorMsg: string | null }) {
  if (state === "idle") {
    return (
      <p className="mt-2 text-[11px] text-muted-foreground" aria-live="polite">
        Le code se compose des deux lettres <span className="font-mono">TD</span> suivies de deux groupes
        de quatre caractères alphanumériques.
      </p>
    );
  }

  if (state === "checking") {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary" aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Adhésion en cours…
      </p>
    );
  }

  return (
    <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-destructive" role="alert" aria-live="assertive">
      <X className="h-3.5 w-3.5" />
      {errorMsg ?? "Erreur."}
    </p>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-xs text-muted-foreground">
      <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span className="text-foreground">{children}</span>
    </li>
  );
}
