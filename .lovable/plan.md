
# Plan — Intégration Supabase + Authentification

> **Prérequis** : tu merges d'abord la branche `claude/audit-design-mvp-dashboard-Zsszd` sur main. Une fois fait, j'exécute le plan ci-dessous.

## 1. Connexion à ton projet Supabase

Activation de l'intégration Supabase native de Lovable pour lier l'app à ton projet existant. Cela génère automatiquement :
- Le client Supabase (`src/integrations/supabase/client.ts`)
- Les types TypeScript de la base
- Les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`

## 2. Schéma base de données (via migration)

### Table `profiles`
Liée à `auth.users` (suppression en cascade). Champs :
- `id` (uuid, PK = auth.users.id)
- `full_name`, `phone_number`, `avatar_url`
- `reliability_score` (int, défaut 100) — score de fiabilité
- `created_at`, `updated_at`

### Enum `app_role` + table `user_roles`
Conforme aux bonnes pratiques de sécurité (rôles **jamais** stockés sur `profiles`).
- Enum : `'admin' | 'organisateur' | 'participant'`
- Table : `user_roles (id, user_id, role)` avec contrainte d'unicité

### Fonction security definer `has_role(user_id, role)`
Pour vérifier les rôles dans les RLS sans récursion.

### Trigger `handle_new_user`
À l'inscription : crée automatiquement la ligne `profiles` et attribue le rôle `participant` par défaut.

### RLS Policies
- `profiles` : lecture publique (pour voir les membres d'un groupe), modification réservée au propriétaire
- `user_roles` : lecture par soi-même et admins, modification par admins uniquement

## 3. Pages d'authentification

### `/auth` — Page combinée connexion / inscription
- Onglets "Se connecter" / "S'inscrire"
- Champs inscription : nom complet, téléphone, email, mot de passe
- Champs connexion : email, mot de passe
- Validation Zod
- `emailRedirectTo: window.location.origin` sur signUp
- Toast d'erreur clair (email déjà utilisé, mot de passe trop court, etc.)
- Design conforme au design system (couleurs primary teal, gradient, logo)

### Hook `useAuth`
Centralise :
- Listener `onAuthStateChange` configuré **avant** `getSession()` (évite deadlock)
- État `user`, `session`, `loading`
- Méthodes `signIn`, `signUp`, `signOut`
- Provider à wrapper autour de l'app dans `App.tsx`

### Composant `ProtectedRoute`
- Redirige vers `/auth` si non connecté
- Affiche un loader pendant la vérification de session
- Protège `/dashboard` et toutes les routes membres

## 4. Mise à jour du Dashboard et navigation

- Ajout bouton "Se déconnecter" dans le header du dashboard
- Affichage du nom de l'utilisateur connecté
- Lien "Se connecter" sur la landing page (Header) → `/auth`
- CTA "Commencer" → `/auth` au lieu de `/dashboard`
- Redirection post-login vers `/dashboard`

## 5. Détails techniques

```text
src/
├── integrations/supabase/      (auto-généré)
│   ├── client.ts
│   └── types.ts
├── hooks/
│   └── useAuth.tsx              (Provider + hook)
├── components/
│   └── ProtectedRoute.tsx
├── pages/
│   └── Auth.tsx                 (login + signup)
└── App.tsx                      (AuthProvider + routes protégées)

supabase/migrations/
└── <timestamp>_init_auth.sql    (profiles, user_roles, trigger, RLS)
```

**Points de sécurité respectés :**
- Rôles dans table séparée (anti escalation)
- Fonction `has_role` en SECURITY DEFINER
- `emailRedirectTo` configuré pour éviter les erreurs de confirmation
- Listener auth configuré avant `getSession`
- Pas de stockage de rôles côté client

## 6. Hors scope (à faire plus tard)

- Réinitialisation de mot de passe (`/reset-password`) — à ajouter quand tu en auras besoin
- 2FA, vérification SMS (OTP Twilio)
- OAuth Google
- Upload avatar (storage bucket)
- CRUD groupes de tontine et cotisations

---

**Dis-moi quand la branche est mergée** et je lance l'implémentation.
