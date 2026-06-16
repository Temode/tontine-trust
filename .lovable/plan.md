## Constat

L'écran actuel `/admin/suppressions` réutilise l'`AppShell` utilisateur : sidebar « Mes groupes / Mes cotisations », badge « PARTICIPANT », header « Rechercher un groupe ». Ce n'est pas un back-office — c'est une page admin glissée dans l'app des participants. On va construire un vrai espace de supervision Tontine, isolé visuellement et fonctionnellement.

## Note sur le sous-domaine

Un vrai sous-domaine `admin.tontine-digitale.app` se configure côté DNS + domaine personnalisé Lovable, hors code. Le code lui-même doit déjà être prêt à vivre seul. On livre donc **un AdminShell autonome monté sous `/admin/*`** qui :
- N'affiche jamais la sidebar / topbar utilisateur
- Refuse l'accès sans le rôle `super_admin`
- Peut être basculé tel quel sur un sous-domaine plus tard (un seul build, route racine `/admin` redirigeable)

## Architecture cible

```
/admin                          → AdminShell (Outlet)
  /admin/overview               → KPIs plateforme
  /admin/suppressions           → File suppressions (existant, relooké)
  /admin/utilisateurs           → Liste + fiche + actions rôles
  /admin/utilisateurs/:id       → Fiche détail
  /admin/groupes                → Liste + fiche + intervention
  /admin/groupes/:id            → Fiche détail (membres, cycles, paiements)
  /admin/audit                  → Log global + webhooks Djomy
  /admin/paiements              → Transactions, échecs, preuves externes
```

Garde-fou : `AdminRoute` (composant) qui exige `roles.includes('super_admin')`, sinon redirect `/dashboard` avec toast « Accès réservé ».

## Sections livrées

### 1. AdminShell + chrome
- Sidebar admin sombre (fond `slate-900`, accent or `#E8AA14`) pour différencier visuellement de l'app user
- Header : titre de section + badge rouge « SUPER ADMIN » + menu compte (déconnexion, retour à l'app user)
- Pas de « Créer un groupe / Rejoindre un groupe » — actions rapides remplacées par « Rafraîchir », « Exporter CSV »

### 2. Vue d'ensemble (`/admin/overview`)
KPIs (cards) : utilisateurs totaux, nouveaux 7j, groupes actifs, cycles en cours, volume cotisé 30j, échecs paiement 7j, demandes suppression ouvertes, fiabilité moyenne. Graphes : volume/jour 30j, signups/jour 30j. Alertes (cards rouges) : webhooks Djomy en échec, groupes sans organisateur, paiements bloqués > 48 h.

### 3. Suppressions (`/admin/suppressions`)
Réutilise la file existante mais relookée pour l'AdminShell : colonnes (Groupe, Demandeur, Votes oui/non, Membres, Cotisation, Demandé le, Échéance), filtre statut (pending_admin / approved / rejected), drawer détail avec historique vote + bouton Approuver/Refuser.

### 4. Utilisateurs & rôles (`/admin/utilisateurs`)
- Recherche email/nom/téléphone, tri date d'inscription, filtre rôle
- Table : avatar, nom, email, rôles (badges), groupes (count), fiabilité, créé le
- Fiche `/utilisateurs/:id` : profil, rôles (toggle admin / super_admin), groupes, paiements récents, log d'audit perso
- Actions : promouvoir/rétrograder, suspendre (flag `profiles.suspended_at`), réinitialiser mot de passe (lien Supabase)

### 5. Groupes & tontines (`/admin/groupes`)
- Recherche nom/code, filtres statut (draft, active, paused, archived, deleted)
- Table : nom, organisateur, membres, statut, cycle en cours, prochaine échéance, volume total
- Fiche `/groupes/:id` : membres, cycles & tours, paiements, audit log
- Actions admin : forcer pause, archiver, lever pause, transférer organisateur

### 6. Audit & paiements (`/admin/audit` + `/admin/paiements`)
- Audit : table `audit_log` paginée, filtre acteur/cible/type d'action, plage de dates, export CSV
- Paiements : transactions Djomy + preuves externes, filtre statut (pending/success/failed/refunded), drawer détail avec payload webhook, retry/refund (placeholder désactivé pour V1)

## Détails techniques

**Migration SQL nécessaire :**
- `profiles.suspended_at timestamptz` (suspension utilisateur)
- Vues admin avec `security_invoker=on` :
  - `admin_platform_kpis` (counts agrégés)
  - `admin_user_overview` (profile + count groupes + rôles agrégés)
  - `admin_group_overview` (group + organisateur + membres count + volume)
  - `admin_payment_overview` (paiements + groupe + membre)
- RPCs `security definer` (toutes gated par `has_role(auth.uid(), 'super_admin')`) :
  - `admin_set_user_role(target_user uuid, role app_role, grant boolean)`
  - `admin_suspend_user(target_user uuid, suspended boolean)`
  - `admin_force_group_status(group_id uuid, status text, reason text)`
- GRANT SELECT sur les vues à `authenticated` ; RLS sur tables sous-jacentes inchangée (les vues sont security_invoker, donc respectent RLS du caller — d'où des policies admin lecture sur `profiles`, `groups`, `payments`, `audit_log` réservées à `super_admin`)

**Fichiers à créer :**
- `src/components/admin/AdminShell.tsx`, `AdminSidebar.tsx`, `AdminTopBar.tsx`, `AdminRoute.tsx`
- `src/pages/admin/Overview.tsx`, `Users.tsx`, `UserDetail.tsx`, `Groups.tsx`, `GroupDetail.tsx`, `Audit.tsx`, `Payments.tsx`
- `src/lib/api/admin.ts` (wrappers vues + RPCs)
- Migration `*_admin_backoffice.sql`
- Refactor `AdminDeletionRequests.tsx` → `src/pages/admin/Deletions.tsx` (sans AppShell)

**Fichiers à modifier :**
- `src/App.tsx` : routes `/admin/*` montées sous `<AdminRoute><AdminShell><Outlet /></AdminShell></AdminRoute>`, hors du groupe `AppShell` user

## Hors scope V1

- Refunds Djomy réels (bouton désactivé, ouvrira un ticket support)
- Édition du contenu des groupes côté admin (lecture + actions de cycle de vie uniquement)
- Bascule DNS sous-domaine `admin.*` (config Lovable, pas du code)
- i18n du back-office (FR uniquement)

## Critères de validation

- `/admin/*` inaccessible à Alice (participant) et Bob (participant) → redirect dashboard + toast
- `/admin/overview` affiche les vrais counts DB
- Promouvoir Bob `admin` depuis `/admin/utilisateurs/:id` ajoute bien la ligne dans `user_roles`
- Approuver une demande de suppression depuis `/admin/suppressions` met `groups.deleted_at`
- Aucune sidebar « Mes groupes » visible sous `/admin/*`
