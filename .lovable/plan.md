## Audit

**1. Menu mobile absent.** La `DesktopSidebar` est en `hidden lg:flex`. La `BottomNav` mobile n'expose que 4 liens (Accueil, Tontines, Créer, Discussions). Toutes les autres sections (Mon solde, Payer, Épargne Solo, International, Commissions, Affiliation, Reçus, Abonnement, Profil, Notifications, Admin…) sont donc inaccessibles depuis mobile — sauf en tapant l'URL manuellement.

**2. Notifications non cliquables.** Le composant `NotificationItem` navigue seulement si `n.link` est défini. Or les notifs d'`invitation_accepted` (« Nouvelle candidature ») insérées par `join_group_with_code` (db/13 et db/42) n'écrivent **jamais** de `link`. Résultat : sur la page `/notifications`, cliquer sur une candidature marque comme lu mais ne redirige nulle part. Idem pour toute notif historique sans `link`.

## Plan

### A. Menu mobile — Drawer accessible depuis la TopBar

1. Ajouter un bouton hamburger dans `TopBar.tsx`, visible uniquement `lg:hidden`, positionné à gauche du titre.
2. Créer `src/components/layout/MobileMenu.tsx` : un `Sheet` (shadcn) côté gauche qui réutilise **la même liste `sections`** que `DesktopSidebar` (extraite dans `src/components/layout/navSections.ts` pour éviter la duplication). Contenu :
   - Bloc marque (logo + nom).
   - Liste des entrées « Essentiel » (mêmes libellés/icônes/routes que desktop).
   - Bloc utilisateur en bas (nom, rôle, bouton « Se déconnecter »).
   - Fermeture automatique du Sheet au clic sur un lien (`onOpenChange`).
3. Refactor : `DesktopSidebar` importe les sections depuis `navSections.ts` (pas de changement visuel desktop).

### B. Notifications cliquables partout

1. **Correctif backend (migration SQL)** — redéployer `join_group_with_code` (dernière version, celle de la migration KYC optionnelle) en ajoutant `link := '/groupes/' || v_invitation.group_id || '/membres'` sur la notif `invitation_accepted` pour que l'organisateur atterrisse sur la page membres (candidatures visibles via `JoinRequestsCard`).
2. **Backfill** : `update public.notifications set link = '/groupes/' || group_id || '/membres' where kind = 'invitation_accepted' and link is null;`
3. **Filet de sécurité frontend** — dans `NotificationItem.tsx` + `Notifications.tsx` + `NotificationBell.tsx`, si `n.link` est `null`, dériver un fallback :
   - `invitation_accepted`, `member_joined` → `/groupes/<group_id>/membres`
   - `cycle_started`, `turn_started`, `turn_paid`, `announcement`, `group_completed` → `/groupes/<group_id>`
   - `contribution_due`, `contribution_received`, `contribution_confirmed` → `/cotisations`
   - `payout_released` → `/solde`
   - `receipt_ready` → `/recus`
   - `reliability_changed` → `/profil`
   - sinon → `/notifications`

Ainsi toute notification devient cliquable, y compris les anciennes.

### Fichiers touchés

- créer `src/components/layout/navSections.ts`
- créer `src/components/layout/MobileMenu.tsx`
- éditer `src/components/layout/TopBar.tsx` (bouton hamburger + montage du Sheet)
- éditer `src/components/layout/DesktopSidebar.tsx` (import des sections partagées)
- éditer `src/components/notifications/NotificationItem.tsx` (fallback link)
- éditer `src/pages/Notifications.tsx` et `src/components/notifications/NotificationBell.tsx` (fallback dans `handleClick`)
- nouvelle migration `supabase/migrations/…_notifications_click_through.sql` : refresh `join_group_with_code` avec `link` + backfill.

### Hors périmètre

Pas de refonte de la `BottomNav` (elle reste à 4 items). Pas de changement du contenu ni du look du sidebar desktop. Aucune modif de la logique de rejoindre / KYC.
