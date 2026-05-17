import { PlusCircle, Search, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

interface EmptyStateProps {
  /** True when the empty state is the result of an active filter / search rather than an absence of groups. */
  filtered?: boolean;
  onClearFilters?: () => void;
}

export function EmptyState({ filtered, onClearFilters }: EmptyStateProps) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-card px-6 py-14 text-center">
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
    <div className="rounded-xl border border-hairline bg-card px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary">
        <PlusCircle className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-base font-bold text-foreground">Démarrez votre premier groupe</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Créez une tontine en quelques secondes ou rejoignez un groupe existant via un code d'invitation.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link
          to="/nouveau"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700"
        >
          <PlusCircle className="h-4 w-4" />
          Créer un groupe
        </Link>
        <Link
          to="/rejoindre"
          className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
        >
          <UserPlus className="h-4 w-4" />
          Rejoindre un groupe
        </Link>
      </div>
    </div>
  );
}
