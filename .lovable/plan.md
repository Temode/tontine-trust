# Plan — Auth Supabase + Rôles + Protection des routes

## 1. Schéma base de données (migration SQL)

### Enum `app_role`
```sql
create type public.app_role as enum ('admin', 'organisateur', 'participant');
```

### Table `profiles`
- `id uuid PK` (= `auth.users.id`, `on delete cascade`)
- `full_name text not null`
- `phone_number text`
- `avatar_url text`
- `reliability_score int default 100`
- `created_at`, `updated_at timestamptz`

### Table `user_roles`
- `id uuid PK default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `role app_role not null`
- `unique (user_id, role)`

### Fonction `has_role(_user_id uuid, _role app_role) returns boolean`
`SECURITY DEFINER`, `stable`, `set search_path = public` — pour éviter la récursion RLS.

### Trigger `handle_new_user`
À chaque insert dans `auth.users` : crée la ligne `profiles` (nom récupéré depuis `raw_user_meta_data->>'full_name'`) et insère le rôle `participant` par défaut dans `user_roles`.

### Trigger `handle_updated_at`
Met à jour `updated_at` sur `profiles`.

### RLS Policies
- **profiles**
  - SELECT : tous les utilisateurs authentifiés (pour afficher membres d'un groupe)
  - UPDATE : `auth.uid() = id`
  - INSERT : géré par le trigger uniquement
- **user_roles**
  - SELECT : `auth.uid() = user_id` OR `has_role(auth.uid(), 'admin')`
  - INSERT/UPDATE/DELETE : `has_role(auth.uid(), 'admin')` uniquement

## 2. Pages et composants Auth

### `src/pages/Auth.tsx`
- Onglets **Se connecter** / **S'inscrire** (composant `Tabs`)
- Inscription : `full_name`, `phone_number`, `email`, `password` (min 8)
- Connexion : `email`, `password`
- Validation **Zod** + react-hook-form
- `signUp` avec `emailRedirectTo: ${window.location.origin}/dashboard` et `data: { full_name, phone_number }`
- Toast d'erreur clair (mapping des messages Supabase : `User already registered`, `Invalid login credentials`, etc.)
- Redirige vers `/dashboard` si déjà connecté
- Design system respecté (primary teal `#0D7377`, logo, gradient subtil)

### `src/hooks/useAuth.tsx`
Provider + hook exposant `{ user, session, roles, loading, signIn, signUp, signOut }`.
- Listener `onAuthStateChange` configuré **avant** `getSession()`
- Charge les rôles depuis `user_roles` après login (via setTimeout 0 pour éviter deadlock)
- `signOut` redirige vers `/auth`

### `src/components/ProtectedRoute.tsx`
- Si `loading` → loader plein écran
- Si `!user` → `<Navigate to="/auth" replace />`
- Sinon → `<Outlet />` (ou `children`)

### `src/components/RoleGuard.tsx`
- Props : `allowedRoles: AppRole[]`, `fallback?: ReactNode`
- Si l'utilisateur ne possède aucun des rôles → fallback (ou null)
- Utilisé pour cacher des sections du Dashboard

## 3. Mise à jour `App.tsx`

```text
<AuthProvider>
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/auth" element={<Auth />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell><Outlet /></AppShell>}>
        <Route path="/dashboard" ... />
        ... (toutes les routes membres actuelles)
      </Route>
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
</AuthProvider>
```
Nettoyage : suppression des routes dupliquées (`/groups`, `/cotisation` qui pointent vers d'anciens composants) et de la route `/` interne au shell.

## 4. Rôles dans le Dashboard

Sections gardées par rôle :
- **admin** : voit tout + un encart "Administration" (KPIs globaux placeholder)
- **organisateur** : voit la `MemberStatusGrid` (état des cotisations du groupe) et le bouton "Inviter / Nouvelle tontine"
- **participant** : voit ses cotisations, sa fiabilité, ses prochaines échéances — masque `MemberStatusGrid` et actions d'organisation

Implémentation : envelopper les blocs concernés du `Dashboard` avec `<RoleGuard allowedRoles={[...]}>`. Le `TopBar` affiche aussi un badge avec le rôle principal et un bouton **Se déconnecter**.

## 5. Détails techniques

```text
src/
├── integrations/supabase/        (déjà généré par la connexion)
├── hooks/useAuth.tsx             (Provider + hook + rôles)
├── components/
│   ├── ProtectedRoute.tsx
│   └── RoleGuard.tsx
├── pages/Auth.tsx
└── App.tsx                       (AuthProvider + routes protégées)

supabase/migrations/
└── <timestamp>_init_auth_roles.sql
```

**Sécurité respectée :**
- Rôles dans table dédiée (anti-escalation)
- `has_role` en `SECURITY DEFINER` avec `search_path` figé
- `onAuthStateChange` avant `getSession`
- Aucun rôle stocké côté client comme source de vérité (toujours revérifié via RLS côté DB)
- `emailRedirectTo` configuré

## 6. Hors scope

- Réinitialisation mot de passe (`/reset-password`)
- OAuth Google, SMS OTP
- Upload avatar
- CRUD groupes / cotisations
- UI admin de gestion des rôles (assignation manuelle se fait via SQL pour le MVP)
