## Problème

Test 2 a montré un e-mail envoyé depuis `no-reply@auth.lovable.cloud` au lieu de `noreply@tontinedigitale.com`. Après audit, aucun code frontend n'appelle `supabase.auth.signUp` ni `resetPasswordForEmail` — tout passe par `auth-otp` (Resend). La seule source restante d'e-mail natif est **`admin.createUser({ email_confirm: false })`** dans `auth-otp/index.ts` : Supabase déclenche automatiquement un e-mail de confirmation pour les users non-confirmés, et si le hook `auth-email-hook` échoue ou n'est pas actif, Supabase retombe sur l'expéditeur par défaut `no-reply@auth.lovable.cloud`.

Pour le test 1 (Resend OK, mais absent de Yopmail), il s'agit d'un problème connu de délivrabilité côté Yopmail (filtrage/blocage silencieux des e-mails Resend). Rien à corriger côté code — recommander un vrai domaine ou Mailtrap pour les tests.

## Correction

### 1. Ne plus déclencher d'e-mail natif Supabase

Dans `supabase/functions/auth-otp/index.ts` → `startSignup` :
- Changer `email_confirm: false` en `email_confirm: true` sur `admin.createUser`.
- Ajouter dans `user_metadata` : `otp_verified: false`.
- Cela **supprime totalement** l'e-mail automatique envoyé par Supabase lors de la création — Resend devient le seul émetteur.

Dans `verifySignup`, remplacer la mise à jour `email_confirm: true` (déjà true) par la mise à jour `user_metadata.otp_verified: true`.

### 2. Bloquer la connexion tant que l'OTP n'est pas validé

Puisque `email_confirm` est désormais `true` à la création, Supabase ne bloque plus `signInWithPassword`. On ajoute un garde côté client :

Dans `src/hooks/useAuth.tsx` → `signIn` :
- Après `signInWithPassword` réussi, lire `user.user_metadata.otp_verified`.
- Si `false` ou absent, appeler `supabase.auth.signOut()` et renvoyer `{ error: "Email non confirmé. Vérifie ta boîte mail." }`.

### 3. Désactiver définitivement les templates natifs Lovable

Appeler `email_domain--toggle_project_emails` avec `enabled: false` pour couper le hook Lovable Emails. Les e-mails natifs Supabase (que nous ne déclenchons plus) tomberaient sinon toujours sur `no-reply@auth.lovable.cloud`. Après désactivation, si un chemin natif venait à se déclencher accidentellement, il échouerait au lieu d'envoyer via un mauvais expéditeur — comportement plus sûr et détectable.

### 4. Vérification finale

- Redéployer `auth-otp`.
- Lancer un vrai signup depuis la preview vers une adresse Gmail (pas Yopmail).
- Vérifier que l'e-mail arrive de `noreply@tontinedigitale.com` et qu'aucun autre e-mail n'est envoyé.
- Vérifier qu'un `signInWithPassword` avant vérification renvoie l'erreur "Email non confirmé".

## Fichiers touchés

- `supabase/functions/auth-otp/index.ts` (createUser flags + verifySignup metadata)
- `src/hooks/useAuth.tsx` (garde otp_verified sur signIn)
- Appel outil : `email_domain--toggle_project_emails { enabled: false }`
- Redeploy edge function `auth-otp`

## Note sur Yopmail

Yopmail bloque fréquemment les e-mails Resend même quand le dashboard Resend indique "delivered". Ce n'est pas un bug de notre côté. Pour les tests futurs, utiliser une vraie adresse (Gmail, Outlook) ou Mailtrap.
