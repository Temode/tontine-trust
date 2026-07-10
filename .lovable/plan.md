
## Objectif

Gérer proprement les comptes existants dont `user_metadata.otp_verified !== true` (legacy, admin, inscriptions antérieures) quand ils tentent de se connecter avec des identifiants corrects. Au lieu d'un simple message "Email non confirmé", on déclenche automatiquement un nouvel OTP via Resend et on redirige vers `/auth/verifier-email` avec un bandeau explicatif.

## Comportement cible (inspiré PayPal / Facebook)

1. L'utilisateur saisit email + mot de passe corrects sur `/auth`.
2. Le backend valide les identifiants. Si `otp_verified !== true` :
   - déconnecte immédiatement la session (déjà en place),
   - déclenche `auth-otp` action `signup_resend` (envoi Resend uniquement, rate-limité),
   - redirige vers `/auth/verifier-email` avec `state.email` et un flag `reason: "legacy_verification"`.
3. `VerifyEmail.tsx` affiche un bandeau d'information temporaire :
   > « Pour renforcer la sécurité de votre compte, une vérification e-mail est désormais requise. Un code de validation vient de vous être envoyé à `email@…`. »
4. Le champ OTP + bouton "Renvoyer le code" + compte à rebours existants restent inchangés.

## Modifications

### 1. `src/hooks/useAuth.tsx` — `signIn`

Actuellement : si `otp_verified !== true`, retourne `"Email non confirmé…"`.

Nouveau contrat de retour :
```ts
{ error: string | null; requiresVerification?: boolean; email?: string }
```
Logique :
- credentials OK + `otp_verified !== true` → `signOut()`, retourne `{ error: null, requiresVerification: true, email }`.
- credentials KO → comportement inchangé.
- credentials OK + `otp_verified === true` → comportement inchangé.

Mise à jour du type `AuthContextValue.signIn` en conséquence.

### 2. `src/pages/Auth.tsx` — `handleSignIn`

Après `signIn(...)` :
- si `requiresVerification === true` :
  - appel `invokeAuthOtp({ action: "signup_resend", email })` (best-effort ; en cas d'erreur `rate_limited`/`email_send_failed`, on redirige quand même et VerifyEmail affichera l'état),
  - `toast.info("Un nouveau code de vérification vient de vous être envoyé.")`,
  - `navigate("/auth/verifier-email", { state: { email, reason: "legacy_verification", resendTriggered: true } })`.
- sinon flux actuel (admin/dashboard) inchangé.

Aucun changement dans le formulaire d'inscription.

### 3. `src/pages/VerifyEmail.tsx`

- Lit `location.state.reason` et `resendTriggered`.
- Si `reason === "legacy_verification"` : affiche un `AuthAlert variant="info"` en tête de page avec le message :
  > « Pour renforcer la sécurité de votre compte, une vérification e-mail est désormais requise. Un code de validation vient de vous être envoyé à **{email}**. Saisissez-le ci-dessous pour finaliser la connexion. »
- Si `resendTriggered === true` au montage : initialiser le compte à rebours du bouton "Renvoyer le code" comme après un resend manuel (empêche un double envoi immédiat).
- Aucun changement à la logique de vérification OTP ni au garde-fou `onAuthStateChange`.

### 4. `supabase/functions/auth-otp/index.ts`

Aucun changement fonctionnel requis : `signup_resend` accepte déjà un email seul, applique le rate-limit (3/10 min), passe uniquement par Resend, et échoue proprement avec `email_send_failed` / `email_not_configured` / `rate_limited`.

Vérification : confirmer que `signup_resend` fonctionne pour un email qui existe déjà dans `auth.users` sans nécessiter `signupPayload` (déjà le cas d'après l'implémentation actuelle). Sinon, ajuster pour tolérer les comptes existants.

## Garde-fous conservés

- `onAuthStateChange` refuse toujours toute session sans `otp_verified === true`.
- `auth-otp` reste le seul chemin d'envoi d'email (test anti-régression déjà en place).
- Rate limit resend inchangé.
- Aucun impact sur les nouvelles inscriptions.

## Vérification

- Test manuel via Playwright : connexion avec un compte legacy → redirection vers `/auth/verifier-email`, bandeau visible, email `email@…` pré-rempli, un seul appel à `auth-otp` (action `signup_resend`), aucun appel à `/auth/v1/signup`.
- Test avec un compte déjà vérifié : flux inchangé (dashboard/admin).
- Test avec mauvais mot de passe : message d'erreur classique, aucun OTP envoyé.
