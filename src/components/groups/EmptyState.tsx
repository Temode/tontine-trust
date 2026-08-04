import { ArrowRight, PlusCircle, RefreshCw, Search, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

interface EmptyStateProps {
  /** True when the empty state is the result of an active filter / search rather than an absence of groups. */
  filtered?: boolean;
  onClearFilters?: () => void;
}

export function EmptyState({ filtered, onClearFilters }: EmptyStateProps) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-card px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Search className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-display text-base font-bold text-foreground">Aucun groupe ne correspond</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Aucun de vos groupes ne correspond à ces critères. Ajustez les filtres ou réinitialisez la recherche.
        </p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-5 rounded-md border border-hairline px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-hairline bg-card">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-accent/[0.04]" />
      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-12 lg:p-10">
        {/* Pitch */}
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-secondary/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Premier pas avec Tontine Digitale
          </span>
          <h3 className="mt-3 font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            Lancez votre première tontine en quelques minutes.
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
            Vous gardez le contrôle, Tontine Digitale orchestre les rotations, sécurise les paiements et garde une trace de chaque mouvement.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              to="/nouveau"
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-700"
            >
              <PlusCircle className="h-4 w-4" />
              Créer une tontine
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/rejoindre"
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-hairline bg-card px-5 text-sm font-medium text-foreground transition hover:bg-secondary"
            >
              <UserPlus className="h-4 w-4" />
              Rejoindre avec un code
            </Link>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Gratuit pour démarrer · Paiement sécurisé via Orange Money, MoMo & carte
          </p>
        </div>

        {/* Benefits */}
        <ul className="grid gap-3 sm:gap-4">
          <BenefitRow
            icon={<RefreshCw className="h-4 w-4" />}
            title="Rotation automatique"
            desc="Les tours s'enchaînent sans rappels manuels ni feuille Excel."
          />
          <BenefitRow
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Paiements sécurisés & traçables"
            desc="Chaque cotisation est horodatée, recue par reçu, conforme RGPD."
          />
          <BenefitRow
            icon={<Sparkles className="h-4 w-4" />}
            title="Score de fiabilité"
            desc="Chaque membre construit une réputation visible et exportable."
          />
        </ul>
      </div>
    </section>
  );
}

function BenefitRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-hairline bg-card/80 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-display text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{desc}</p>
      </div>
    </li>
  );
}
