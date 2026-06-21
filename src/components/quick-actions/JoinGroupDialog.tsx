import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, ShieldCheck, UserPlus, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatGNF } from "@/lib/format";
import { previewByCode, type InvitationPreview } from "@/lib/api/invitations";

const CODE_RE = /^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function normalizeCode(raw: string): string {
  // Auto-uppercase + auto-dash : "tdabcd1234" → "TD-ABCD-1234"
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length <= 2) return cleaned;
  const body = cleaned.startsWith("TD") ? cleaned.slice(2) : cleaned;
  const a = body.slice(0, 4);
  const b = body.slice(4, 8);
  return b ? `TD-${a}-${b}` : a ? `TD-${a}` : "TD";
}

export function JoinGroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [debouncedCode, setDebouncedCode] = useState("");
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce the code lookup
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCode(code), 350);
    return () => clearTimeout(t);
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    if (!CODE_RE.test(debouncedCode)) {
      setPreview(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    previewByCode(debouncedCode)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setPreview(null);
          setError(e.message || "Code introuvable.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedCode]);

  const reset = () => {
    setCode("");
    setDebouncedCode("");
    setPreview(null);
    setError(null);
    setLoading(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleConfirm = () => {
    if (!preview) return;
    handleOpenChange(false);
    navigate(`/rejoindre?code=${encodeURIComponent(debouncedCode)}`);
  };

  const codeValid = CODE_RE.test(debouncedCode);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-hairline px-6 pb-4 pt-6 text-left">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
            <UserPlus className="h-3 w-3" />
            Rejoindre une tontine
          </span>
          <DialogTitle className="mt-2 font-display text-2xl font-bold tracking-tight">
            Entrez votre code d'invitation
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Format <span className="font-medium text-foreground">TD-XXXX-XXXX</span>. Reçu par l'organisateur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <input
            type="text"
            autoFocus
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            placeholder="TD-XXXX-XXXX"
            maxLength={11}
            className="h-12 w-full rounded-xl border border-hairline bg-card px-4 text-center font-display text-lg font-bold tracking-[0.25em] text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />

          {/* Preview / error / loading */}
          <div className="min-h-[112px]">
            {loading ? (
              <div className="flex h-28 items-center justify-center rounded-xl border border-hairline bg-secondary/30">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/[0.04] px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : preview ? (
              <article className="rounded-xl border border-hairline bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-bold text-foreground">{preview.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Organisé par {preview.organizer_name}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <Stat label="Cotisation" value={`${formatGNF(preview.contribution_amount)} GNF`} />
                  <Stat label="Fréquence" value={capitalize(preview.frequency)} />
                  <Stat label="Membres" value={`${preview.members_count} / ${preview.max_members}`} />
                </dl>
              </article>
            ) : codeValid ? null : (
              <div className="rounded-xl border border-dashed border-hairline bg-secondary/20 px-4 py-6 text-center text-xs text-muted-foreground">
                Saisissez un code complet pour voir le récapitulatif.
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-hairline bg-card/60 px-6 py-4">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="inline-flex h-10 items-center rounded-lg border border-hairline bg-card px-4 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!preview}
            className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-700 disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            Continuer
            <ArrowRight className="h-4 w-4" />
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-display text-sm font-semibold text-foreground num">{value}</dd>
    </div>
  );
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}