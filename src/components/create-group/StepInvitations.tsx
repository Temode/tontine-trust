import { Copy, RefreshCcw, Shield } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateInviteCode, type GroupDraft, type Visibility } from "./types";
import { StepWrapper } from "./StepWrapper";

interface StepInvitationsProps {
  draft: GroupDraft;
  onChange: (patch: Partial<GroupDraft>) => void;
  onBack?: () => void;
  onContinue?: () => void;
  index: number;
  total: number;
}

const VISIBILITY_OPTIONS: Array<{
  id: Visibility;
  label: string;
  description: string;
}> = [
  {
    id: "private",
    label: "Privé · sur invitation",
    description: "Seules les personnes que vous invitez explicitement par numéro peuvent rejoindre.",
  },
  {
    id: "public-link",
    label: "Lien partageable",
    description: "Un lien unique permet à toute personne de demander à rejoindre, validation requise.",
  },
  {
    id: "directory",
    label: "Annuaire public",
    description: "Le groupe apparaît dans la recherche Tontine Digital. Validation des candidats requise.",
  },
];

export function StepInvitations({ draft, onChange, onBack, onContinue, index, total }: StepInvitationsProps) {
  const fullLink = `https://tontine.digital/join/${draft.inviteCode.replace(/-/g, "")}`;

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(draft.inviteCode).catch(() => undefined);
    toast.success("Code copié", { description: draft.inviteCode });
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(fullLink).catch(() => undefined);
    toast.success("Lien d'invitation copié");
  };

  const handleRegenerate = () => {
    const ok = typeof window === "undefined"
      ? true
      : window.confirm(
          "Remplacer le code d'invitation ? Le code actuel ne sera pas activé tant que vous n'avez pas émis le groupe.",
        );
    if (!ok) return;
    onChange({ inviteCode: generateInviteCode() });
    toast("Nouveau code généré", { description: "Le précédent ne sera pas émis." });
  };

  const coOrganizers = draft.coOrganizerPhones
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <StepWrapper
      index={index}
      total={total}
      title="Invitations & accès"
      description="Comment les futurs membres rejoignent-ils ? Définissez le code, le mode de partage et désignez d'éventuels co-organisateurs."
      canContinue={true}
      onBack={onBack}
      onContinue={onContinue}
    >
      <div className="space-y-7">
        {/* Code d'invitation */}
        <section>
          <Header title="Code d'invitation" hint="Identifiant unique du groupe. Communiquez-le aux personnes que vous souhaitez inviter." />

          <div className="mt-3 rounded-lg border border-hairline bg-secondary/30 p-4">
            <div className="flex items-center gap-3">
              <p className="flex-1 truncate font-mono text-2xl font-bold tracking-[0.18em] text-foreground num">
                {draft.inviteCode}
              </p>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-card px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
              >
                <Copy className="h-3.5 w-3.5" />
                Copier
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                aria-label="Régénérer le code"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-card text-muted-foreground transition hover:text-foreground"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-md border border-hairline bg-card px-3 py-2 text-xs text-muted-foreground">
              <span className="truncate font-mono">{fullLink}</span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-hairline px-2 text-[11px] font-medium text-foreground transition hover:bg-secondary"
              >
                <Copy className="h-3 w-3" />
                Lien
              </button>
            </div>
          </div>
        </section>

        {/* Visibilité */}
        <section>
          <Header title="Visibilité du groupe" hint="Qui peut découvrir ou rejoindre votre tontine ?" />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {VISIBILITY_OPTIONS.map((opt) => {
              const active = draft.visibility === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange({ visibility: opt.id })}
                  aria-pressed={active}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left transition",
                    active ? "border-primary bg-primary-50/40 ring-1 ring-primary/20" : "border-hairline hover:bg-secondary/40",
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Co-organisateurs */}
        <section>
          <Header
            title="Co-organisateurs (facultatif)"
            hint="Désignez des personnes qui peuvent valider les adhésions et trancher en cas de litige."
          />
          <textarea
            id="cg-co-organizers"
            value={draft.coOrganizerPhones}
            onChange={(e) => onChange({ coOrganizerPhones: e.target.value })}
            placeholder={"+224 621 XX XX XX\n+224 661 XX XX XX"}
            rows={3}
            className="mt-3 w-full rounded-md border border-hairline bg-card px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Un numéro par ligne ou séparés par des virgules. {coOrganizers.length > 0 && (
              <span className="font-medium text-foreground num">
                {coOrganizers.length} co-organisateur{coOrganizers.length > 1 ? "s" : ""} détecté{coOrganizers.length > 1 ? "s" : ""}.
              </span>
            )}
          </p>
        </section>

        <p className="inline-flex items-start gap-2 rounded-md border border-hairline bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          <span>
            Chaque code est unique au groupe et tracé. Vous pouvez le révoquer ou en générer un nouveau
            à tout moment depuis « Inviter des membres ».
          </span>
        </p>
      </div>
    </StepWrapper>
  );
}

function Header({ title, hint }: { title: string; hint: string }) {
  return (
    <header>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </header>
  );
}
