import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const RESEND_DELAY = 60;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const head = local.slice(0, 1);
  const tail = local.length > 2 ? local.slice(-1) : "";
  return `${head}${"•".repeat(Math.max(1, local.length - head.length - tail.length))}${tail}@${domain}`;
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { email?: string } };
  const [params] = useSearchParams();
  const { user, loading } = useAuth();

  const email = location.state?.email ?? params.get("email") ?? user?.email ?? "";
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_DELAY);
  const [resending, setResending] = useState(false);
  const submittedFor = useRef<string | null>(null);

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
        toast.error("Email manquant. Recommence l'inscription.");
        return;
      }
      setStatus("verifying");
      setErrorMsg(null);
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
      if (error) {
        setStatus("error");
        setErrorMsg("Code invalide ou expiré. Vérifie tes 6 chiffres.");
        setCode("");
        submittedFor.current = null;
        return;
      }
      setStatus("success");
      toast.success("Email vérifié");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
    },
    [email, navigate],
  );

  useEffect(() => {
    if (code.length === 6 && submittedFor.current !== code && status !== "verifying" && status !== "success") {
      submittedFor.current = code;
      void verify(code);
    }
  }, [code, status, verify]);

  const handleResend = async () => {
    if (countdown > 0 || resending || !email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (error) {
      if (/rate limit/i.test(error.message)) {
        toast.error("Trop d'emails envoyés. Patiente quelques minutes.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Nouveau code envoyé");
    setCountdown(RESEND_DELAY);
  };

  const masked = useMemo(() => (email ? maskEmail(email) : ""), [email]);

  if (!loading && user?.email_confirmed_at) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-secondary/40 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center">
          <Logo />
        </Link>

        <div className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
          {status === "success" ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Email vérifié
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Redirection vers ton espace…
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Vérifie ton email
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Nous avons envoyé un code à 6 chiffres à
                {masked ? (
                  <>
                    {" "}
                    <span className="font-semibold text-foreground">{masked}</span>.
                  </>
                ) : (
                  " ton adresse email."
                )}
              </p>

              <div className="mt-8 flex flex-col items-center">
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
                  disabled={status === "verifying"}
                  autoFocus
                  containerClassName="gap-3"
                >
                  <InputOTPGroup className="gap-3">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="h-14 w-12 rounded-lg border-hairline bg-background font-display text-2xl font-bold tabular-nums text-foreground shadow-sm focus-within:ring-2 focus-within:ring-primary"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>

                <div className="mt-3 h-5 text-sm">
                  {status === "verifying" && (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Vérification…
                    </span>
                  )}
                  {status === "error" && errorMsg && (
                    <span className="text-destructive">{errorMsg}</span>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-col items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResend}
                  disabled={countdown > 0 || resending}
                  className="text-sm"
                >
                  {resending
                    ? "Envoi…"
                    : countdown > 0
                    ? `Renvoyer le code dans ${countdown}s`
                    : "Renvoyer le code"}
                </Button>
                <Link
                  to="/auth"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Utiliser un autre email
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Le code expire au bout d'une heure. Vérifie tes courriers indésirables si besoin.
        </p>
      </div>
    </main>
  );
}
