## Plan

### 1. Refonte de la fonction `auth-otp`

Remplacer `admin.generateLink({type:"signup"})` — qui crée le compte ET déclenche un email par défaut de Supabase — par un flux 100% contrôlé :

- `signup_start`
  - `admin.createUser({ email, password, email_confirm: false, user_metadata })` : crée le compte non vérifié, sans envoyer aucun email.
  - Si l'email existe déjà :
    - vérifié → renvoyer `email_exists`
    - non vérifié → mettre à jour password + metadata et renvoyer un nouveau code.
  - Générer un code aléatoire à 6 chiffres cryptographiquement sûr.
  - Stocker `email_hash + purpose + token_hash + expires_at (15 min)` dans `auth_otp_requests`.
  - Envoyer le code via Resend (gateway déjà en place) avec le template `SignupEmail`.

- `verify_signup`
  - Chercher la dernière ligne active dans `auth_otp_requests` par `email_hash + purpose='signup' + token_hash + status='sent' + expires_at > now()`.
  - Échec → `invalid_code`.
  - Succès → `admin.updateUserById(id, { email_confirm: true })` puis marquer la ligne `consumed`.
  - Si le client renvoie le password (déjà stocké dans `location.state` côté front), ouvrir la session avec `signInWithPassword` et retourner la session — sinon renvoyer juste `success`.

- `recovery_start` / `recovery_complete`
  - Même approche maison (code généré et envoyé via Resend, vérification par comparaison de `token_hash`).
  - `recovery_start` ne divulgue pas l'existence du compte (toujours `success`).

### 2. Front `VerifyEmail.tsx`

Ajouter le password (déjà présent dans `location.state.signupPayload`) dans le corps de l'appel `verify_signup`, pour que la session soit ouverte automatiquement à la fin de la vérification.

### 3. Aucun changement de schéma

`auth_otp_requests` possède déjà toutes les colonnes nécessaires (`email_hash`, `purpose`, `token_hash`, `status`, `expires_at`, `consumed_at`, `created_at`).

### 4. Tests

Après déploiement :
- Nouvelle inscription : un seul mail Resend arrive depuis `noreply@tontinedigitale.com`, avec code à 6 chiffres, aucun email `no-reply@auth.lovable.cloud`.
- Saisie du code → session ouverte, redirection `/dashboard`.
- Tentative de `signIn` avant validation → message "Email non confirmé".
- Code faux ou expiré → message "Code invalide ou expiré".

## Détails techniques

Fichiers touchés :
- `supabase/functions/auth-otp/index.ts` : refonte des 4 actions.
- `src/pages/VerifyEmail.tsx` : ajout du password dans le body `verify_signup`.

Aucune migration SQL, aucun changement dans `Auth.tsx`, `useAuth.tsx` ou `authOtp.ts`.