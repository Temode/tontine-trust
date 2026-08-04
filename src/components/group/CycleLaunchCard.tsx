import { Play, CheckCircle2, Circle } from "lucide-react";

interface Props {
  activeMembers: number;
  /** Conditions générales acceptées par l'utilisateur courant (null = inconnu). */
  termsAccepted: boolean | null;
  isOrganizer: boolean;
  isPending: boolean;
  onStart: () => void;
  onAcceptTerms: () => void;
}

/**
 * Encart unique et toujours visible tant qu'aucun cycle n'est en cours.
 * Affiche la checklist des prérequis et une seule action primaire.
 */
export function CycleLaunchCard({
  activeMembers, termsAccepted, isOrganizer, isPending, onStart, onAcceptTerms,
}: Props) {
  const membersOk = activeMembers >= 2;
  const termsOk = termsAccepted !== false;
  const ready = membersOk && termsOk;

  const steps = [
    {
      ok: membersOk,
      label: membersOk
        ? `${activeMembers} membres actifs`
        : `Au moins 2 membres actifs (actuellement ${activeMembers})`,
    },
    {
      ok: termsOk,
      label: termsOk
        ? "Conditions générales acceptées"
        : "Conditions générales et protection des données à accepter",
    },
  ];

  return (
    <section className="mt-5 rounded-2xl border border-accent-200 bg-accent-50/60 p-5 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-600 text-accent-foreground">
            <Play className="h-4 w-4" />
          </div>
          <div>
            <p className="font-display text-base font-bold text-foreground">
              {ready ? "Prêt à démarrer le cycle" : "Démarrage du cycle"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              L'ordre de rotation sera tiré et les {Math.max(activeMembers, 0)} tours planifiés.
            </p>
            <ul className="mt-3 space-y-1.5">
              {steps.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-xs">
                  {s.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={s.ok ? "text-muted-foreground" : "font-medium text-foreground"}>
                    {s.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {isOrganizer ? (
          !termsOk ? (
            <button
              type="button"
              onClick={onAcceptTerms}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-accent-600 px-5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-700"
            >
              Accepter les conditions
            </button>
          ) : (
          <button
            type="button"
            disabled={!ready || isPending}
            onClick={onStart}
            title={ready ? undefined : "Complétez les prérequis ci-dessus"}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-accent-600 px-5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-700 disabled:opacity-50"
          >
            {isPending ? "Démarrage…" : "Démarrer le cycle"}
          </button>
          )
        ) : (
          <p className="shrink-0 text-xs text-muted-foreground">
            L'organisateur démarrera le cycle.
          </p>
        )}
      </div>
    </section>
  );
}
