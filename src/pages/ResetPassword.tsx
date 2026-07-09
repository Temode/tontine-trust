import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AuthShell,
  authFieldInput,
  authFieldLabel,
  authPrimaryButton,
} from "@/components/auth/AuthShell";
import { AuthStepper } from "@/components/auth/AuthStepper";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { supabase } from "@/integrations/supabase/client";

const schema = z
  .object({
    password: z.string().min(8, "Au moins 8 caractères").max(72),
    confirm: z.string().min(8, "Au moins 8 caractères").max(72),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["confirm"],
  });

const STEPS = [
  { label: "Email" },
  { label: "Nouveau mot de passe" },
  { label: "Terminé" },
];

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; global?: string }>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Nouveau mot de passe · Tontine Digital";
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const fieldErrs: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "password" | "confirm";
        if (!fieldErrs[key]) fieldErrs[key] = issue.message;
      }
      setErrors(fieldErrs);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setSubmitting(false);
    if (error) {
      setErrors({ global: error.message });
      return;
    }
    setDone(true);
    toast.success("Mot de passe mis à jour");
    setTimeout(() => navigate("/dashboard", { replace: true }), 1400);
  };

  const currentStep = done ? 2 : 1;

  return (
    <AuthShell>
      <AuthStepper steps={STEPS} current={currentStep} className="mb-8" />

      {!ready ? (
        <div className="space-y-4" aria-busy="true">
          <div className="h-9 w-56 animate-pulse rounded bg-foreground/5" />
          <div className="h-4 w-72 animate-pulse rounded bg-foreground/5" />
          <div className="mt-6 h-11 w-full animate-pulse rounded bg-foreground/5" />
          <div className="h-11 w-full animate-pulse rounded bg-foreground/5" />
          <div className="h-11 w-full animate-pulse rounded bg-foreground/5" />
        </div>
      ) : !hasSession ? (
        <>
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Lien invalide ou expiré
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              Ce lien de réinitialisation n'est plus valide. Demandez-en un nouveau.
            </p>
          </header>

          <AuthAlert variant="error" title="Réinitialisation impossible">
            Les liens expirent au bout d'une heure et ne peuvent être utilisés qu'une seule fois.
          </AuthAlert>

          <Link
            to="/auth/mot-de-passe-oublie"
            className={`${authPrimaryButton} mt-6`}
          >
            Redemander un lien
          </Link>
        </>
      ) : done ? (
        <>
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Mot de passe mis à jour
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              Redirection vers votre espace en cours…
            </p>
          </header>
          <AuthAlert variant="success" title="Modification confirmée">
            Vous pouvez désormais vous connecter avec votre nouveau mot de passe.
          </AuthAlert>
        </>
      ) : (
        <>
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Nouveau mot de passe
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              Choisissez un mot de passe solide, d'au moins 8 caractères.
            </p>
          </header>

          {errors.global && (
            <AuthAlert variant="error" title="Impossible de mettre à jour" className="mb-5">
              {errors.global}
            </AuthAlert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="pw" className={authFieldLabel}>Nouveau mot de passe</label>
              <input
                id="pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                required
                aria-invalid={!!errors.password}
                className={authFieldInput}
              />
              {errors.password && (
                <p className="pt-1 text-[12px] font-medium text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pw2" className={authFieldLabel}>Confirmer</label>
              <input
                id="pw2"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
                }}
                required
                aria-invalid={!!errors.confirm}
                className={authFieldInput}
              />
              {errors.confirm && (
                <p className="pt-1 text-[12px] font-medium text-destructive">{errors.confirm}</p>
              )}
            </div>

            <button type="submit" disabled={submitting} className={authPrimaryButton}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Mettre à jour le mot de passe
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
