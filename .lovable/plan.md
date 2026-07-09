## Diagnostic

Deux problèmes observés :

1. **Expéditeur `Tontine-Trust <no-reply@auth.lovable.cloud>`** au lieu de `no-reply@` sur notre domaine configuré dans Resend.
2. **Aucun code à 6 chiffres** dans l'email — juste un bouton « Verify Email ». Or notre page `/auth/verifier-email` attend un OTP à 6 chiffres (via `supabase.auth.verifyOtp({ type: "signup" })`).

**Cause** : aucun template d'email d'auth personnalisé n'a été scaffoldé. Supabase envoie donc son email par défaut (lien magique, expéditeur `auth.lovable.cloud`), ce qui contourne à la fois notre domaine Resend et notre flux OTP.

## Plan

### 1. Scaffolder les templates d'emails d'auth (managed Lovable)
Utiliser `email_domain--scaffold_auth_email_templates` — ceci crée :
- `supabase/functions/auth-email-hook/index.ts` (le hook Supabase qui prend le relais des envois auth)
- `supabase/functions/_shared/email-templates/*.tsx` (6 templates React Email)

Les emails partiront alors du domaine déjà vérifié dans Resend, avec le nom d'expéditeur « Tontine Digitale ».

### 2. Personnaliser le template `signup.tsx` pour afficher le code à 6 chiffres
Injecter `{{ .Token }}` (fourni automatiquement par Supabase) dans une carte visuelle typographiée « Infrastructure Calme » — grands chiffres tabulaires, teal + or, note « Ce code expire dans 1 heure ». Retirer le CTA « Verify Email » (bouton lien) qui n'a pas de sens dans notre parcours OTP, garder un lien de secours discret.

### 3. Harmoniser les 5 autres templates
Appliquer la charte Tontine Digitale (couleurs `--primary` teal `#0D7377`, `--accent` or `#E8AA14`, Inter, radius, wordmark) à :
- `recovery.tsx` (mot de passe oublié) — afficher aussi le code OTP pour cohérence avec `/auth/reinitialiser-mot-de-passe`
- `magic-link.tsx`, `invite.tsx`, `email-change.tsx`, `reauthentication.tsx`

### 4. Déployer
`supabase--deploy_edge_functions` sur `auth-email-hook`.

### 5. Vérifier
- Refaire un signup depuis `/auth` avec un email yopmail.
- Confirmer que l'expéditeur est `no-reply@<domaine-resend>` avec « Tontine Digitale » comme nom.
- Confirmer que le mail contient bien 6 chiffres lisibles.
- Saisir le code dans `/auth/verifier-email` → redirection `/dashboard`.

## Détails techniques

- Aucun code frontend à changer — le flux OTP existe déjà et attend `type: "signup"`.
- Aucun changement de `useAuth.signUp` ni des routes.
- Le hook `auth-email-hook` remplace intégralement l'expéditeur par défaut Supabase dès qu'il est déployé, donc les deux problèmes (expéditeur + contenu) sont résolus en une seule opération.
- DNS déjà vérifié (domaine actif), donc les emails partiront immédiatement après déploiement.

## Fichiers touchés

- **Créés** par le scaffold : `supabase/functions/auth-email-hook/index.ts`, `supabase/functions/auth-email-hook/deno.json`, `supabase/functions/_shared/email-templates/{signup,recovery,magic-link,invite,email-change,reauthentication}.tsx`
- **Édités** ensuite : les 6 templates (branding + OTP visible sur signup & recovery)
