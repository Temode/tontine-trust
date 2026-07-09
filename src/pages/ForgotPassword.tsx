import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  AuthShell,
  authFieldInput,
  authFieldLabel,
  authPrimaryButton,
} from "@/components/auth/AuthShell";
import { AuthStepper } from "@/components/auth/AuthStepper";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { invokeAuthOtp } from "@/lib/authOtp";

const schema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
});

const STEPS = [
  { label: "Email" },
  { label: "Nouveau mot de passe" },
  { label: "Terminé" },
];

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  useEffect(() => {
    document.title = "Mot de passe oublié · Tontine Digital";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    setRateLimited(false);
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await invokeAuthOtp({
      action: "recovery_start",
      email: parsed.data.email,
    });
    setSubmitting(false);
    if (error && /trop d'emails|tentatives|patiente/i.test(error)) {
      setRateLimited(true);
      return;
    }
    // On n'expose pas l'existence du compte : succès dans tous les autres cas.
    setSent(true);
  };

  return (
    <AuthShell>
      <AuthStepper steps={STEPS} current={sent ? 1 : 0} className="mb-8" />

      {sent ? (
        <>
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Vérifiez votre boîte mail
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              Nous vous avons envoyé un code de réinitialisation.
            </p>
          </header>

          <AuthAlert variant="success" title="Email envoyé">
            Si un compte existe pour{" "}
            <span className="font-semibold text-foreground">{email}</span>, un lien de
            code à 6 chiffres vient d'être envoyé. Il expire dans 1 heure.
          </AuthAlert>

          <div className="mt-8 flex flex-col gap-4">
            <Link
              to="/auth/reinitialiser"
              state={{ email }}
              className={authPrimaryButton}
            >
              Saisir le code reçu
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la connexion
            </Link>
          </div>
        </>
      ) : (
        <>
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Mot de passe oublié
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              Saisissez votre email : nous vous enverrons un code pour définir un nouveau mot de passe.
            </p>
          </header>

          {rateLimited && (
            <AuthAlert variant="error" title="Trop de tentatives" className="mb-5">
              Attendez quelques minutes avant de réessayer.
            </AuthAlert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="fp-email" className={authFieldLabel}>Email</label>
              <input
                id="fp-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldError) setFieldError(null);
                }}
                placeholder="nom@entreprise.com"
                required
                aria-invalid={!!fieldError}
                className={authFieldInput}
              />
              {fieldError && (
                <p className="pt-1 text-[12px] font-medium text-destructive">{fieldError}</p>
              )}
            </div>

            <button type="submit" disabled={submitting} className={authPrimaryButton}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Envoyer le code de réinitialisation
            </button>
          </form>

          <div className="mt-8">
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la connexion
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
