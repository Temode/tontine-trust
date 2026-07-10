## Plan de test end-to-end

Objectif : prouver que le flux Resend → OTP → session fonctionne sans erreur avec un vrai email.

### Étapes

1. **Créer un email jetable** `td-verify-<timestamp>@yopmail.com`.
2. **Appeler `auth-otp` en direct** (via `curl_edge_functions`) avec `action: signup_start` + un mot de passe test + un nom, en simulant l'appel du front.
3. **Vérifier en base** que la ligne existe dans `auth_otp_requests` avec `purpose=signup`, `status=sent`, `expires_at` à +15 min, et que le user existe dans `auth.users` avec `email_confirmed_at IS NULL`.
4. **Lire l'inbox yopmail** via Playwright pour confirmer que le mail vient de `noreply@tontinedigitale.com` (et non de `no-reply@auth.lovable.cloud`) et extraire le code à 6 chiffres.
5. **Appeler `verify_signup`** avec l'email, le code, et le password. Vérifier que la réponse contient une `session` valide.
6. **Vérifier en base** que `email_confirmed_at` est renseigné et que la ligne OTP est passée à `status=consumed`.
7. **Test négatif** : rappeler `verify_signup` avec un code faux → 400 `invalid_code`. Rappeler `verify_signup` avec le même code déjà consommé → 400 `invalid_code`.
8. **Test blocage login pré-vérif** : créer un second user, tenter `signInWithPassword` sans avoir validé l'OTP → doit renvoyer `Email not confirmed`.
9. **Nettoyage** : supprimer les users de test via l'API admin.

### Livrables

Rapport clair avec, pour chaque étape : succès/échec, statut HTTP, ID du mail Resend, et capture yopmail montrant l'expéditeur.

Aucun changement de code prévu — c'est un plan de validation. Si un test échoue, je préparerai un plan correctif séparé.