# Diagnostic de l'inscription

J'ai créé un compte test depuis `/auth`. La requête `POST /auth/v1/signup` renvoie :

```
HTTP 429 — x-sb-error-code: over_email_send_rate_limit
{"code":"over_email_send_rate_limit","message":"email rate limit exceeded"}
```

**Cause** : dans ton projet Supabase, "Confirm email" est activé mais aucun SMTP custom n'est configuré → le SMTP par défaut de Supabase est plafonné à ~3-4 emails/heure, et la limite est atteinte. Le code front fait son travail, le bloquant est la config Supabase + l'absence de gestion fine de ce cas.

Un second risque latent : si la migration SQL `db/init_auth_roles.sql` n'a pas été exécutée, le trigger `handle_new_user` n'existe pas et chaque signup réussi renvoie `Database error saving new user`. À vérifier en parallèle.

---

# Plan d'action

## 1. Débloquer l'inscription côté Supabase (action utilisateur, 30 s)

Deux options au choix (je détaillerai dans le chat après approbation) :

- **Recommandé pour tester maintenant** : Supabase Dashboard → Authentication → Providers → Email → décocher **"Confirm email"**. Les nouveaux comptes seront actifs immédiatement.
- **Pour la prod** : configurer un SMTP custom (Resend, Brevo, SendGrid) dans Authentication → Emails → SMTP Settings.

Et vérifier que `db/init_auth_roles.sql` a bien été exécuté dans le SQL Editor (tables `profiles`, `user_roles`, fonction `has_role`, trigger `on_auth_user_created`).

## 2. Robustifier le flux d'auth (code)

Fichier `src/hooks/useAuth.tsx` :
- Étendre `mapAuthError` : gérer `over_email_send_rate_limit`, `email_address_invalid`, `weak_password`, `Database error saving new user`, `signups not allowed`.
- `signUp` retourne aussi `needsEmailConfirmation: boolean` (true si `data.session === null && data.user !== null`) pour permettre un message UX adapté.
- Auto-sign-in après `signUp` si une session est déjà fournie (cas "Confirm email" désactivé).

Fichier `src/pages/Auth.tsx` :
- Après `signUp` réussi : si `needsEmailConfirmation`, afficher un message "Vérifie ta boîte mail pour confirmer" et basculer sur l'onglet Connexion ; sinon, rediriger directement vers `/dashboard`.
- Désactiver le bouton pendant 30 s après une erreur de rate limit pour éviter la boucle.

## 3. Formulaire de mise à jour du profil (post-login, RLS-safe)

Nouveau composant `src/components/profile/ProfileUpdateForm.tsx` :
- Champs : `full_name` (requis, 2-100, trim), `phone_number` (optionnel, regex E.164 souple `^\+?[0-9\s\-]{6,20}$`).
- Validation Zod, messages d'erreur français, `toast` succès/erreur.
- Chargement initial via `supabase.from('profiles').select('full_name, phone_number').eq('id', user.id).single()`.
- Soumission via `supabase.from('profiles').update({ full_name, phone_number }).eq('id', user.id)` — autorisée par la policy `profiles_update_own` (`auth.uid() = id`), donc strictement RLS-safe.
- État `loading` initial, `saving` à la soumission, bouton désactivé tant que pas modifié.

Intégration : remplacer le bouton "Modifier le profil" de `src/pages/Profile.tsx` par l'ouverture d'un `Dialog` contenant `ProfileUpdateForm`, OU monter le formulaire directement dans l'onglet **Identité & KYC** (préférable, plus visible). Je choisirai la 2e option sauf indication contraire.

La route `/profile` est déjà derrière `ProtectedRoute` → exigence "accessible après connexion" satisfaite.

## 4. Vérification finale

Après les changements et la config Supabase :
- Recréer un compte depuis `/auth` (email frais) → doit arriver sur `/dashboard`.
- Aller sur `/profile`, modifier nom + téléphone, recharger → valeurs persistées.
- Vérifier en SQL : `select id, full_name, phone_number from public.profiles where id = auth.uid();`

---

# Détails techniques

- Pas de changement de schéma DB nécessaire — la migration existante couvre tout.
- Pas de nouvelles dépendances (Zod, supabase-js, shadcn Dialog déjà présents).
- Aucune logique métier déplacée côté client sensible : la sécurité reste portée par les policies RLS (`profiles_update_own` filtre déjà par `auth.uid()`).
- `useAuth` rafraîchira `roles` automatiquement après login via `onAuthStateChange` (déjà en place).
