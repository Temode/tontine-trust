import { useEffect, useState } from "react";
import { ArrowRight, ClipboardPaste, Loader2, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { findDirectoryGroupByCode } from "@/lib/mock-data";
import type { DirectoryGroup } from "@/lib/types";

interface CodeEntryHeroProps {
  onMatch: (group: DirectoryGroup) => void;
  onClear: () => void;
  matchedCode?: string;
}

type LookupState = "idle" | "checking" | "found" | "not-found";

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
  const [code, setCode] = useState(matchedCode ?? "");
  const [state, setState] = useState<LookupState>(matchedCode ? "found" : "idle");

  useEffect(() => {
    if (!isComplete(code)) {
      if (state !== "idle") {
        setState("idle");
        onClear();
      }
      return;
    }

    setState("checking");
    const timer = window.setTimeout(() => {
      const match = findDirectoryGroupByCode(code);
      if (match) {
        setState("found");
        onMatch(match);
      } else {
        setState("not-found");
        onClear();
      }
    }, 600);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

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
    onClear();
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
                state === "found" && "border-success/40 ring-2 ring-success/20",
                state === "not-found" && "border-destructive/40 ring-2 ring-destructive/15",
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
                maxLength={11}
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
              </div>
            </div>

            <StateLine state={state} />
          </div>
        </div>

        <aside className="rounded-lg border border-hairline bg-secondary/40 p-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Sécurité
          </p>
          <ul className="mt-3 space-y-2.5 text-sm">
            <Bullet>Chaque code est cryptographiquement signé et tracé.</Bullet>
            <Bullet>Une seule adhésion par numéro et par cycle.</Bullet>
            <Bullet>Tout code expire automatiquement à la complétion du groupe.</Bullet>
            <Bullet>Les organisateurs valident manuellement chaque demande.</Bullet>
          </ul>
          <p className="mt-4 inline-flex items-start gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <span>Aucun débit n'est exécuté avant la confirmation explicite de votre adhésion.</span>
          </p>
        </aside>
      </div>
    </article>
  );
}

function StateLine({ state }: { state: LookupState }) {
  if (state === "idle") {
    return (
      <p className="mt-2 text-[11px] text-muted-foreground">
        Le code se compose des deux lettres <span className="font-mono">TD</span> suivies de deux groupes
        de quatre caractères alphanumériques.
      </p>
    );
  }

  if (state === "checking") {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Vérification auprès du registre Tontine Digital…
      </p>
    );
  }

  if (state === "not-found") {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
        <X className="h-3.5 w-3.5" />
        Aucun groupe trouvé. Le code peut être révoqué, expiré ou mal saisi.
      </p>
    );
  }

  return (
    <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-success">
      <ShieldCheck className="h-3.5 w-3.5" />
      Code valide · prospectus chargé ci-dessous.
      <ArrowRight className="h-3.5 w-3.5" />
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
