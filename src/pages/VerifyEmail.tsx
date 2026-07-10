import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthStepper } from "@/components/auth/AuthStepper";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { invokeAuthOtp } from "@/lib/authOtp";

const RESEND_DELAY = 60;

const STEPS = [
  { label: "Compte créé" },
  { label: "Vérification email" },
  { label: "Accès à l'espace" },
];

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const head = local.slice(0, 1);
  const tail = local.length > 2 ? local.slice(-1) : "";
  return `${head}${"•".repeat(Math.max(1, local.length - head.length - tail.length))}${tail}@${domain}`;
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation() as {
    state?: {
      email?: string;
      signupPayload?: { email: string; password: string; fullName: string; phoneNumber?: string | null };
      reason?: "legacy_verification" | string;
      resendTriggered?: boolean;
      expiresAt?: string | null;
      isAdmin?: boolean;
    };
  };
  const [params] = useSearchParams();
  const { user, loading } = useAuth();

  const email = location.state?.email ?? params.get("email") ?? user?.email ?? "";
  const isLegacyVerification = location.state?.reason === "legacy_verification";
  const isAdminLegacy = isLegacyVerification && location.state?.isAdmin === true;
  const [expiresAt, setExpiresAt] = useState<string | null>(
    location.state?.expiresAt ?? null,
  );
  const initialCountdown = location.state?.resendTriggered ? RESEND_DELAY : 0;
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(initialCountdown);
  const [resending, setResending] = useState(false);
  const submittedFor = useRef<string | null>(null);

  // Compte à rebours d'expiration du code (mm:ss).
  const [expiresInSec, setExpiresInSec] = useState<number>(() => {
    if (!location.state?.expiresAt) return 0;
    const diff = new Date(location.state.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      setExpiresInSec(Math.max(0, Math.floor(diff / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const expiryLabel = useMemo(() => {
    if (!expiresAt) return null;
    const d = new Date(expiresAt);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }, [expiresAt]);
  const expiryMmSs = useMemo(() => {
    const m = Math.floor(expiresInSec / 60);
    const s = expiresInSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [expiresInSec]);

  useEffect(() => {
    document.title = "Vérification de l'email · Tontine Digital";
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const verify = useCallback(
    async (token: string) => {
      if (!email) {
        setStatus("error");
        setErrorMsg("Email manquant. Reprenez l'inscription depuis le début.");
        return;
      }
      setStatus("verifying");
      setErrorMsg(null);
      const { data, error } = await invokeAuthOtp<{
        session?: { access_token: string; refresh_token: string };
      }>({
        action: "verify_signup",
        email,
        token,
        password: location.state?.signupPayload?.password,
      });
      if (error) {
        setStatus("error");
        setErrorMsg(error);
        setCode("");
        submittedFor.current = null;
        return;
      }
      if (data?.session?.access_token && data.session.refresh_token) {
        await supabase.auth.setSession(data.session);
      }
      setStatus("success");
      toast.success("Email vérifié");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1400);
    },
    [email, navigate, location.state],
  );

  useEffect(() => {
    if (
      code.length === 6 &&
      submittedFor.current !== code &&
      status !== "verifying" &&
      status !== "success"
    ) {
      submittedFor.current = code;
      void verify(code);
    }
  }, [code, status, verify]);

  const handleResend = async () => {
    if (countdown > 0 || resending || !email) return;
    setResending(true);
    const { data, error } = await invokeAuthOtp<{ expiresAt?: string }>({
      action: "signup_resend",
      email,
    });
    setResending(false);
    if (error) {
      if (/trop d'emails|tentatives|patiente/i.test(error)) {
        toast.error("Trop d'emails envoyés. Patientez quelques minutes avant un nouvel essai.");
        setCountdown(RESEND_DELAY);
      } else {
        toast.error(error);
      }
      return;
    }
    toast.success("Nouveau code envoyé. Vérifiez votre boîte mail et vos spams.");
    setCountdown(RESEND_DELAY);
    if (data?.expiresAt) setExpiresAt(data.expiresAt);
  };

  const masked = useMemo(() => (email ? maskEmail(email) : ""), [email]);

  if (!loading && user?.email_confirmed_at) {
    return <Navigate to="/dashboard" replace />;
  }

  const currentStep = status === "success" ? 2 : 1;
  const disabled = status === "verifying" || status === "success";

  return (
    <AuthShell>
      <AuthStepper steps={STEPS} current={currentStep} className="mb-8" />

      {status === "success" ? (
        <>
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Email vérifié
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              Redirection vers votre espace en cours…
            </p>
          </header>
          <AuthAlert variant="success" title="Compte activé">
            Votre email a été vérifié avec succès. Bienvenue sur Tontine Digitale.
          </AuthAlert>
        </>
      ) : (
        <>
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Vérifiez votre email
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              Nous avons envoyé un code à 6 chiffres à
              {masked ? (
                <>
                  {" "}
                  <span className="font-semibold text-foreground">{masked}</span>.
                </>
              ) : (
                " votre adresse email."
              )}
            </p>
          </header>

          {isLegacyVerification && (
            <div className="mb-6">
              <AuthAlert variant="info" title="Vérification e-mail requise">
                Pour renforcer la sécurité de votre compte, une vérification e-mail est désormais
                requise. Un code de validation vient de vous être envoyé
                {masked ? (
                  <>
                    {" "}à <span className="font-semibold text-foreground">{masked}</span>
                  </>
                ) : null}
                . Saisissez-le ci-dessous pour finaliser votre connexion.
              </AuthAlert>
            </div>
          )}

          <div className="rounded-xl border border-foreground/10 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/50">
              Code de vérification
            </p>

            <div className="mt-4 flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (status === "error") {
                    setStatus("idle");
                    setErrorMsg(null);
                  }
                }}
                disabled={disabled}
                autoFocus
                containerClassName="gap-2 sm:gap-3"
              >
                <InputOTPGroup className="gap-2 sm:gap-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-14 w-11 rounded-md border-foreground/15 bg-white text-2xl font-bold tabular-nums text-foreground shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:w-12"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="mt-5 min-h-[52px]">
              {status === "verifying" && (
                <AuthAlert variant="loading" title="Vérification en cours">
                  Nous validons votre code auprès de nos serveurs.
                </AuthAlert>
              )}
              {status === "error" && errorMsg && (
                <AuthAlert
                  variant="error"
                  title={
                    /expiré/i.test(errorMsg)
                      ? "Code expiré"
                      : /déjà été utilisé/i.test(errorMsg)
                      ? "Code déjà utilisé"
                      : "Code incorrect"
                  }
                >
                  {errorMsg}
                </AuthAlert>
              )}
              {status === "idle" && (
                <p className="text-center text-[12px] text-foreground/45">
                  Le code se valide automatiquement dès la saisie des 6 chiffres.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || resending}
                aria-disabled={countdown > 0 || resending}
                className="text-sm font-semibold text-primary transition hover:underline disabled:cursor-not-allowed disabled:text-foreground/40 disabled:no-underline"
              >
                {resending ? "Envoi en cours…" : "Renvoyer le code"}
              </button>
              {countdown > 0 && !resending && (
                <span
                  role="timer"
                  aria-live="polite"
                  className="inline-flex min-w-[3.5rem] justify-center rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground/60"
                >
                  {countdown}s
                </span>
              )}
            </div>
            <Link
              to="/auth"
              className="text-[12px] text-foreground/50 hover:text-foreground/80"
            >
              Utiliser une autre adresse email
            </Link>
          </div>

          <p className="mt-8 border-t border-foreground/5 pt-6 text-[11px] leading-relaxed text-foreground/40">
            Le code expire au bout de 15 minutes. Vous ne le recevez pas ? Vérifiez vos courriers
            indésirables, confirmez que l'adresse ci-dessus est correcte, puis cliquez sur
            « Renvoyer le code » (limite : 3 envois par 10 minutes).
          </p>
        </>
      )}

      {loading && status === "idle" && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-foreground/40">
          <Loader2 className="h-3 w-3 animate-spin" />
          Chargement de la session…
        </div>
      )}
    </AuthShell>
  );
}
