import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthShell,
  authFieldInput,
  authFieldLabel,
  authFooterLegal,
  authPrimaryButton,
} from "@/components/auth/AuthShell";

const signInSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(8, "Au moins 8 caractères").max(72),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Nom requis").max(100),
  phoneNumber: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(8, "Au moins 8 caractères").max(72),
});

export default function Auth() {
  const { user, loading, roles, rolesLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const fromPath =
    location.state?.from && location.state.from !== "/auth" ? location.state.from : null;
  const defaultPath = roles.includes("super_admin") ? "/admin/overview" : "/dashboard";
  const redirectTo = fromPath ?? defaultPath;

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);

  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  const [suFullName, setSuFullName] = useState("");
  const [suPhone, setSuPhone] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");

  useEffect(() => {
    document.title = "Connexion · Tontine Digital";
  }, []);

  if (loading || (user && rolesLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to={redirectTo} replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email: siEmail, password: siPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    const { data: sess } = await supabase.auth.getUser();
    const uid = sess.user?.id;
    let isAdmin = false;
    if (uid) {
      const { data: rolesRows, error: rolesErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (rolesErr) console.error("[Auth] role lookup failed", rolesErr);
      isAdmin = (rolesRows ?? []).some((r) => r.role === "super_admin");
    }
    let dest: string;
    if (fromPath) {
      const fromIsAdmin = fromPath.startsWith("/admin");
      if (fromIsAdmin && !isAdmin) dest = "/dashboard";
      else dest = fromPath;
    } else {
      dest = isAdmin ? "/admin/overview" : "/dashboard";
    }
    toast.success("Connexion réussie");
    navigate(dest, { replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({
      fullName: suFullName,
      phoneNumber: suPhone,
      email: suEmail,
      password: suPassword,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error, needsEmailConfirmation } = await signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
      phoneNumber: parsed.data.phoneNumber || undefined,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (needsEmailConfirmation) {
      toast.success("Compte créé. Saisis le code à 6 chiffres reçu par email.");
      navigate("/auth/verifier-email", {
        state: {
          email: parsed.data.email,
          signupPayload: {
            email: parsed.data.email,
            password: parsed.data.password,
            fullName: parsed.data.fullName,
            phoneNumber: parsed.data.phoneNumber || null,
          },
        },
      });
      return;
    }
    toast.success("Compte créé. Bienvenue !");
    navigate(redirectTo, { replace: true });
  };

  const isSignIn = tab === "signin";

  return (
    <AuthShell>
      <header className="mb-8 sm:mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Bienvenue
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          {isSignIn
            ? "Gérez votre tontine en toute sérénité."
            : "Ouvrez votre compte en moins d'une minute."}
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Authentification"
        className="mb-8 flex border-b border-foreground/10"
      >
        <button
          type="button"
          role="tab"
          aria-selected={isSignIn}
          onClick={() => setTab("signin")}
          className={`-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
            isSignIn
              ? "border-primary text-primary"
              : "border-transparent text-foreground/40 hover:text-foreground/70"
          }`}
        >
          Se connecter
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isSignIn}
          onClick={() => setTab("signup")}
          className={`-mb-px ml-8 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
            !isSignIn
              ? "border-primary text-primary"
              : "border-transparent text-foreground/40 hover:text-foreground/70"
          }`}
        >
          S'inscrire
        </button>
      </div>

      {isSignIn ? (
        <form onSubmit={handleSignIn} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="si-email" className={authFieldLabel}>Email</label>
            <input
              id="si-email"
              type="email"
              autoComplete="email"
              value={siEmail}
              onChange={(e) => setSiEmail(e.target.value)}
              placeholder="nom@entreprise.com"
              required
              className={authFieldInput}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="si-password" className={authFieldLabel}>
                Mot de passe
              </label>
              <Link
                to="/auth/mot-de-passe-oublie"
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Oublié ?
              </Link>
            </div>
            <input
              id="si-password"
              type="password"
              autoComplete="current-password"
              value={siPassword}
              onChange={(e) => setSiPassword(e.target.value)}
              placeholder="••••••••"
              required
              className={authFieldInput}
            />
          </div>

          <button type="submit" disabled={submitting} className={authPrimaryButton}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Se connecter à mon compte
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="su-name" className={authFieldLabel}>Nom complet</label>
            <input
              id="su-name"
              type="text"
              autoComplete="name"
              value={suFullName}
              onChange={(e) => setSuFullName(e.target.value)}
              placeholder="Aïssatou Diallo"
              required
              className={authFieldInput}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="su-phone" className={authFieldLabel}>
              Téléphone{" "}
              <span className="normal-case tracking-normal text-foreground/30">(optionnel)</span>
            </label>
            <input
              id="su-phone"
              type="tel"
              autoComplete="tel"
              value={suPhone}
              onChange={(e) => setSuPhone(e.target.value)}
              placeholder="+224 ..."
              className={authFieldInput}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="su-email" className={authFieldLabel}>Email</label>
            <input
              id="su-email"
              type="email"
              autoComplete="email"
              value={suEmail}
              onChange={(e) => setSuEmail(e.target.value)}
              placeholder="nom@entreprise.com"
              required
              className={authFieldInput}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="su-password" className={authFieldLabel}>Mot de passe</label>
            <input
              id="su-password"
              type="password"
              autoComplete="new-password"
              value={suPassword}
              onChange={(e) => setSuPassword(e.target.value)}
              placeholder="••••••••"
              required
              className={authFieldInput}
            />
            <p className="pt-1 text-[11px] text-foreground/40">Au moins 8 caractères.</p>
          </div>

          <button type="submit" disabled={submitting} className={authPrimaryButton}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer mon compte
          </button>
        </form>
      )}

      <footer className={authFooterLegal}>
        En continuant, vous acceptez nos{" "}
        <a href="#" className="underline underline-offset-2 hover:text-foreground/60">
          Conditions Générales
        </a>{" "}
        et notre{" "}
        <a href="#" className="underline underline-offset-2 hover:text-foreground/60">
          Politique de Confidentialité
        </a>
        . Tontine Digitale est un service de gestion financière sécurisé.
      </footer>
    </AuthShell>
  );
}
