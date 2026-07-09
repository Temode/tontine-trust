## Diagnostic

Les logs de l'edge function `auth-otp` montrent, pour un code fraîchement envoyé et saisi dans les secondes qui suivent :

```
verify_signup failed { errMessage: "Token has expired or is invalid", errStatus: 403 }
verify_signup retry(email) failed { errMessage: "Token has expired or is invalid" }
```

Le code envoyé par email est bien celui généré côté serveur (`email_otp` de `admin.generateLink`), mais Supabase le refuse immédiatement. La cause quasi-certaine : **le paramètre Auth `auto_confirm_email` est activé** sur le projet. Dans ce mode, `generateLink({type:"signup"})` crée le compte **et le marque confirmé instantanément** → l'OTP renvoyé n'a plus rien à confirmer et sort en `expired/invalid` dès la première tentative.

Effet secondaire à connaître : le compte `saaddaan@yopmail.com` existe désormais en base (créé au premier `signup_start`), donc les prochains `signup_start` sur ce mail renverront `email_exists` tant qu'il n'est pas supprimé.

## Ce qu'il faut faire

### 1. Désactiver l'auto-confirmation email

Appliquer via `supabase--configure_auth` :

- `auto_confirm_email: false`
- `disable_signup: false`
- `external_anonymous_users_enabled: false`
- `password_hibp_enabled: true` (bonne pratique, laisser tel quel s'il est déjà à true)

Après ça, `generateLink({type:"signup"})` retournera un OTP effectivement consommable par `verifyOtp`.

### 2. Nettoyer l'edge function `auth-otp`

Une fois le vrai problème corrigé, le fallback ajouté au tour précédent (`type: "email"`) n'a plus lieu d'être et masque de futurs vrais bugs. Retour à la forme simple :

- `verifyOtp({ email, token, type: "signup" })`
- En cas d'échec, logger `error.message` et renvoyer `invalid_code`
- Aucun `retry(email)`

### 3. Purger le compte de test bloqué

Le compte `saaddaan@yopmail.com` a été créé et auto-confirmé pendant le bug. Pour rejouer le test de bout en bout :

- Supprimer l'utilisateur (via `supabase.auth.admin.deleteUser`) — je le ferai en mode build par un appel one-shot, sans exposer l'ID en clair côté utilisateur.
- Alternative si le compte doit être conservé : tester avec un email neuf (`audit-otp-YYYYMMDD-hhmm@yopmail.com`).

### 4. Vérification

- Redéploiement de `auth-otp`.
- Test end-to-end via le preview : inscription → réception de l'email Resend → saisie du code copié/collé → arrivée sur `/dashboard`.
- Lecture des logs `auth-otp` pour confirmer l'absence de `verify_signup failed`.

## Détails techniques

```text
Cause :   auto_confirm_email = true
          └─ generateLink(signup) crée + confirme le user
             └─ email_otp retourné mais déjà "consommé" côté Auth
                └─ verifyOtp → 403 "Token has expired or is invalid"

Correctif : auto_confirm_email = false
          └─ user créé mais non confirmé
             └─ email_otp reste valide 1 h
                └─ verifyOtp(signup) → session OK
```

Fichiers touchés :
- `supabase/functions/auth-otp/index.ts` (retrait du fallback + log net)
- Aucun changement front, aucune migration SQL

Ce qui n'est pas fait :
- Pas de changement des templates emails Resend
- Pas de rotation de clés
- Pas de republication (la fonction edge est prise en compte automatiquement)
