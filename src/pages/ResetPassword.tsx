import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  AuthShell,
  authFieldInput,
  authFieldLabel,
  authPrimaryButton,
} from "@/components/auth/AuthShell";
import { AuthStepper } from "@/components/auth/AuthStepper";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { invokeAuthOtp } from "@/lib/authOtp";

const schema = z
  .object({
    email: z.string().trim().email("Email invalide").max(255),
    code: z.string().regex(/^\d{6}$/, "Code à 6 chiffres requis"),
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
  const location = useLocation() as { state?: { email?: string } };
  const [params] = useSearchParams();
  const initialEmail = useMemo(
    () => location.state?.email ?? params.get("email") ?? "",
    [location.state?.email, params],
  );
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    code?: string;
    password?: string;
    confirm?: string;
    global?: string;
  }>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Nouveau mot de passe · Tontine Digital";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ email, code, password, confirm });
    if (!parsed.success) {
      const fieldErrs: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "email" | "code" | "password" | "confirm";
        if (!fieldErrs[key]) fieldErrs[key] = issue.message;
      }
      setErrors(fieldErrs);
      return;
    }
    setSubmitting(true);
    const { error } = await invokeAuthOtp({
      action: "recovery_complete",
      email: parsed.data.email,
      token: parsed.data.code,
      password: parsed.data.password,
    });
    setSubmitting(false);
    if (error) {
      setErrors({ global: error });
      return;
    }
    setDone(true);
    toast.success("Mot de passe mis à jour");
    setTimeout(() => navigate("/auth", { replace: true }), 1400);
  };

  const currentStep = done ? 2 : 1;

  return (
    <AuthShell>
      <AuthStepper steps={STEPS} current={currentStep} className="mb-8" />

      {done ? (
        <>
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Mot de passe mis à jour
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              Redirection vers la connexion en cours…
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
              Saisissez le code reçu par email puis choisissez un mot de passe solide.
            </p>
          </header>

          {errors.global && (
            <AuthAlert variant="error" title="Impossible de mettre à jour" className="mb-5">
              {errors.global}
            </AuthAlert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="rp-email" className={authFieldLabel}>Email</label>
              <input
                id="rp-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
                required
                aria-invalid={!!errors.email}
                className={authFieldInput}
              />
              {errors.email && (
                <p className="pt-1 text-[12px] font-medium text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <p className={authFieldLabel}>Code de réinitialisation</p>
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (errors.code) setErrors((p) => ({ ...p, code: undefined }));
                }}
                containerClassName="gap-2 sm:gap-3"
              >
                <InputOTPGroup className="gap-2 sm:gap-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-12 w-10 rounded-md border-foreground/15 bg-white text-xl font-bold tabular-nums text-foreground shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:h-14 sm:w-12"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {errors.code && (
                <p className="pt-1 text-[12px] font-medium text-destructive">{errors.code}</p>
              )}
            </div>

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

          <div className="mt-8">
            <Link
              to="/auth/mot-de-passe-oublie"
              className="text-[12px] text-foreground/50 hover:text-foreground/80"
            >
              Demander un nouveau code
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
