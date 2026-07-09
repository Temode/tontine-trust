import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
});

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = "Mot de passe oublié · Tontine Digital";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/auth/reinitialiser`,
    });
    setSubmitting(false);
    if (error) {
      // Ne fuit pas l'existence du compte : on affiche succès sauf sur rate limit.
      if (/rate limit/i.test(error.message)) {
        toast.error("Trop de tentatives. Réessaie dans quelques minutes.");
        return;
      }
    }
    setSent(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-secondary/40 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center">
          <Logo />
        </Link>

        <div className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary">
                <MailCheck className="h-6 w-6" />
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Vérifie ta boîte mail
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Si un compte existe pour <span className="font-semibold text-foreground">{email}</span>, un lien de réinitialisation vient d'être envoyé. Il expire dans 1 heure.
              </p>
              <Link
                to="/auth"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Mot de passe oublié
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Saisis ton email : nous t'enverrons un lien pour définir un nouveau mot de passe.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Envoyer le lien
                </Button>
              </form>

              <Link
                to="/auth"
                className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à la connexion
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
