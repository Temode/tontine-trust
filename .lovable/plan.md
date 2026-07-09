## Objectif

Compléter le flux d'authentification Tontine Digital avec:
1. Réinitialisation du mot de passe (lien email + page nouveau mot de passe).
2. Vérification d'email par code OTP 6 chiffres après inscription, avec renvoi possible après 60s.
3. Protection stricte des routes privées (déjà quasi-en place, à vérifier + polir).

Fidèle à la doctrine : bleu sarcelle `#0D7377` + or `#E8AA14`, `font-display` bold tracking-tight, une seule action primaire par écran, beaucoup d'air, tokens sémantiques uniquement, skeletons plutôt que spinners.

## 1. Mot de passe oublié

### Nouvelle page `/auth/mot-de-passe-oublie` (`src/pages/ForgotPassword.tsx`)
- Formulaire minimal: email + un seul CTA "Envoyer le lien".
- Validation client Zod (email, max 255).
- Appelle `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${origin}/auth/reinitialiser })`.
- État de succès non-devinable : "Si un compte existe, un lien vient d'être envoyé à cet email" (anti-énumération → validation serveur implicite via Supabase Auth, qui applique aussi rate-limit).
- Lien discret "Retour à la connexion".

### Nouvelle page `/auth/reinitialiser` (`src/pages/ResetPassword.tsx`)
- Publique (pas derrière ProtectedRoute).
- Détecte `type=recovery` (hash Supabase). Écoute `onAuthStateChange` pour l'événement `PASSWORD_RECOVERY` afin de récupérer la session temporaire.
- Deux champs: nouveau mot de passe + confirmation. Zod: min 8, max 72, égalité des deux champs.
- Appel `supabase.auth.updateUser({ password })` → validation serveur (Supabase).
- Succès → redirige vers `/dashboard` (session déjà active) avec toast.
- Erreur si token expiré → CTA "Redemander un lien".

### Lien depuis `/auth`
- Ajouter sous le champ mot de passe de l'onglet "Se connecter" : petit lien `text-sm text-primary` "Mot de passe oublié ?" → `/auth/mot-de-passe-oublie`.

## 2. Vérification email par OTP 6 chiffres

Supabase envoie déjà, dans l'email de confirmation d'inscription, à la fois un lien et un token 6 chiffres (`{{ .Token }}`). On exploite le token via `supabase.auth.verifyOtp({ email, token, type: 'signup' })`.

### Modification `useAuth.signUp`
- Retirer `emailRedirectTo` (on veut pousser l'utilisateur à saisir le code plutôt que cliquer un lien).
- Continuer à renvoyer `needsEmailConfirmation`.

### Nouvelle page `/auth/verifier-email` (`src/pages/VerifyEmail.tsx`)
- Reçoit l'email via `location.state.email` (fallback: query string `?email=`).
- Design "infrastructure financière":
  - Carte centrée `max-w-md`, coins arrondis `rounded-2xl`, border hairline, ombre légère.
  - En-tête: logo, `font-display text-2xl` "Vérifie ton email", sous-titre `text-sm text-muted-foreground` avec email masqué (`j***@domaine.com`).
  - Bloc OTP: 6 slots via `<InputOTP>` de `@/components/ui/input-otp` (shadcn, déjà dispo), taille généreuse (`h-14 w-12 text-2xl font-display tabular-nums`), gap 3, focus ring primary. Auto-submit dès 6 chiffres saisis.
  - État "vérifié" : icône check dans pastille `bg-primary-50`, message "Email vérifié", redirection auto vers `/dashboard` après 1.2s.
  - État "en attente" : par défaut, sous-titre "Nous avons envoyé un code à 6 chiffres…".
  - État "erreur" : message rouge sous les slots, slots reset.
  - Bouton "Renvoyer le code" désactivé, avec compte à rebours `Renvoyer dans 60s`. Après 60s → actif; nouveau clic redémarre le compteur.
  - Renvoi via `supabase.auth.resend({ type: 'signup', email })`. Gère erreur `over_email_send_rate_limit` avec message clair.
  - Une seule action primaire visible (Vérifier — mais auto-submit, donc CTA compact secondaire "Vérifier" en dessous des slots pour accessibilité clavier).
  - Lien discret "Utiliser un autre email" → retour à `/auth` tab signup.

### Redirection après signup
- Dans `Auth.tsx` `handleSignUp`, si `needsEmailConfirmation` → `navigate('/auth/verifier-email', { state: { email } })` au lieu de basculer l'onglet.
- Si l'utilisateur revient à `/auth` avec une session partielle non confirmée: laisser tel quel, Supabase gère.

### Badge "email vérifié / en attente" pour l'utilisateur connecté
- Petit indicateur dans le menu avatar `AppShell` (si l'espace le permet, sinon dans `/profil`): pastille `bg-primary-50 text-primary` "Email vérifié" ou `bg-amber-50 text-amber-700` "Email en attente" selon `user.email_confirmed_at`. CTA "Renvoyer" qui repointe vers `/auth/verifier-email` avec l'email prérempli. (Uniquement dans `/profil` pour rester sobre — pas dans la TopBar.)

## 3. Protection des routes non connectées

Déjà en place via `ProtectedRoute` (App.tsx wraps `/dashboard`, `/groupes`, `/admin/*`, etc.). Vérifications additionnelles:
- Ajouter `/auth/reinitialiser` en route publique (hors ProtectedRoute).
- Ajouter `/auth/verifier-email` en route publique.
- Ajouter `/auth/mot-de-passe-oublie` en route publique.
- Confirmer que la redirection `state.from` fonctionne pour un utilisateur qui atterrit sur une deep-link privée (déjà OK dans Auth.tsx via `fromPath`).
- Aucune route sensible ne doit rester en dehors de `ProtectedRoute` (audit rapide : toutes les routes app/admin sont déjà dedans dans `App.tsx`).

## Fichiers créés

- `src/pages/ForgotPassword.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/VerifyEmail.tsx`

## Fichiers modifiés

- `src/App.tsx` — 3 nouvelles routes publiques.
- `src/pages/Auth.tsx` — lien "Mot de passe oublié", redirection vers `/auth/verifier-email` après signup.
- `src/hooks/useAuth.tsx` — retirer `emailRedirectTo` du signUp (on privilégie l'OTP).
- `src/pages/Profile.tsx` — bloc discret "Email vérifié / en attente" + CTA renvoi.

## Détails techniques

- OTP: `import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"`. Composant shadcn déjà présent dans le projet.
- Validation serveur: assurée par Supabase Auth (rate-limit, token hashé, expiration ~1h par défaut). Pas de fonction edge custom nécessaire.
- Rate-limit renvoi email: géré côté Supabase; message d'erreur mappé dans `mapAuthError`.
- Aucune modif de config auth (`configure_auth`) — on garde les paramètres actuels. La confirmation email doit rester activée côté projet pour que le flux OTP soit pertinent (déjà le cas).
- Skeleton pendant le check de la session recovery sur `/auth/reinitialiser` (pas de spinner).
- Aucune couleur hardcodée: on utilise `text-primary`, `bg-primary-50`, `text-amber-700`, etc., déjà définis dans `tailwind.config.ts`.
