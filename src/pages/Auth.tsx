import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const signInSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(8, "Au moins 8 caractères").max(72),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Nom requis").max(100),
  phoneNumber: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(8, "Au moins 8 caractères").max(72),
});

export default function Auth() {
  const { user, loading, roles, rolesLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const fromPath = location.state?.from && location.state.from !== "/auth" ? location.state.from : null;
  const defaultPath = roles.includes("super_admin") ? "/admin/overview" : "/dashboard";
  const redirectTo = fromPath ?? defaultPath;

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);

  // SignIn fields
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // SignUp fields
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
    // Récupère le rôle pour rediriger les admins vers le back-office.
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
      // On respecte la route d'origine uniquement si elle est cohérente avec le rôle.
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
      navigate("/auth/verifier-email", { state: { email: parsed.data.email } });
      return;
    }
    toast.success("Compte créé. Bienvenue !");
    navigate(redirectTo, { replace: true });
  };

  const isSignIn = tab === "signin";

  const fieldLabel = "text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/50";
  const fieldInput =
    "w-full rounded-md border border-foreground/10 bg-white px-4 py-3 text-sm text-foreground placeholder:text-foreground/25 shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      {/* Panneau institutionnel — desktop uniquement */}
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground md:sticky md:top-0 md:flex md:h-screen md:w-5/12 md:flex-col md:justify-between lg:w-1/2 lg:p-16">
        <Link to="/" className="relative z-10 flex items-center gap-3">
          <span className="h-8 w-8 rounded-sm bg-accent" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">Tontine Digitale</span>
        </Link>

        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-tight lg:text-5xl">
            L'infrastructure de confiance pour l'épargne collective.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-primary-foreground/75 lg:text-lg">
            Rejoignez des milliers de groupes qui gèrent leur tontine avec la sécurité et la clarté d'une institution financière moderne.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-10 border-t border-primary-foreground/10 pt-8">
          <div className="flex flex-col">
            <span className="num text-2xl font-semibold text-accent">12 000+</span>
            <span className="mt-1 text-[11px] uppercase tracking-[0.14em] text-primary-foreground/50">
              Cotisations sécurisées
            </span>
          </div>
          <div className="flex flex-col">
            <span className="num text-2xl font-semibold text-accent">99,9%</span>
            <span className="mt-1 text-[11px] uppercase tracking-[0.14em] text-primary-foreground/50">
              Disponibilité
            </span>
          </div>
        </div>

        {/* Motif discret */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(currentColor 0.6px, transparent 0.6px)",
            backgroundSize: "22px 22px",
          }}
        />
      </aside>

      {/* Colonne formulaire */}
      <section className="flex flex-1 items-center justify-center px-6 py-12 sm:px-12 md:px-16 md:py-16 lg:px-24">
        <div className="w-full max-w-[400px]">
          {/* Logo mobile */}
          <Link
            to="/"
            className="mb-10 inline-flex items-center gap-2 md:hidden"
          >
            <span className="h-6 w-6 rounded-sm bg-primary" aria-hidden />
            <span className="text-base font-semibold tracking-tight">Tontine Digitale</span>
          </Link>

          <header className="mb-10">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Bienvenue</h1>
            <p className="mt-2 text-sm text-foreground/60">
              {isSignIn
                ? "Gérez votre tontine en toute sérénité."
                : "Ouvrez votre compte en moins d'une minute."}
            </p>
          </header>

          {/* Tabs custom */}
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
                <label htmlFor="si-email" className={fieldLabel}>
                  Email
                </label>
                <input
                  id="si-email"
                  type="email"
                  autoComplete="email"
                  value={siEmail}
                  onChange={(e) => setSiEmail(e.target.value)}
                  placeholder="nom@entreprise.com"
                  required
                  className={fieldInput}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="si-password" className={fieldLabel}>
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
                  className={fieldInput}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.99] disabled:opacity-70"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Se connecter à mon compte
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="su-name" className={fieldLabel}>
                  Nom complet
                </label>
                <input
                  id="su-name"
                  type="text"
                  autoComplete="name"
                  value={suFullName}
                  onChange={(e) => setSuFullName(e.target.value)}
                  placeholder="Aïssatou Diallo"
                  required
                  className={fieldInput}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="su-phone" className={fieldLabel}>
                  Téléphone <span className="normal-case tracking-normal text-foreground/30">(optionnel)</span>
                </label>
                <input
                  id="su-phone"
                  type="tel"
                  autoComplete="tel"
                  value={suPhone}
                  onChange={(e) => setSuPhone(e.target.value)}
                  placeholder="+224 ..."
                  className={fieldInput}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="su-email" className={fieldLabel}>
                  Email
                </label>
                <input
                  id="su-email"
                  type="email"
                  autoComplete="email"
                  value={suEmail}
                  onChange={(e) => setSuEmail(e.target.value)}
                  placeholder="nom@entreprise.com"
                  required
                  className={fieldInput}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="su-password" className={fieldLabel}>
                  Mot de passe
                </label>
                <input
                  id="su-password"
                  type="password"
                  autoComplete="new-password"
                  value={suPassword}
                  onChange={(e) => setSuPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={fieldInput}
                />
                <p className="pt-1 text-[11px] text-foreground/40">Au moins 8 caractères.</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.99] disabled:opacity-70"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer mon compte
              </button>
            </form>
          )}

          <footer className="mt-12 border-t border-foreground/5 pt-8">
            <p className="text-[11px] leading-relaxed text-foreground/40">
              En continuant, vous acceptez nos{" "}
              <a href="#" className="underline underline-offset-2 hover:text-foreground/60">
                Conditions Générales
              </a>{" "}
              et notre{" "}
              <a href="#" className="underline underline-offset-2 hover:text-foreground/60">
                Politique de Confidentialité
              </a>
              . Tontine Digitale est un service de gestion financière sécurisé.
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}