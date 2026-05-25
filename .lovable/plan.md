## Phase F — Centre de notifications

Migration Phase E appliquée. Phase E déjà implémentée côté code (scores, badges, vue profil). On passe à la Phase F : notifications in-app pour tenir les membres informés des événements clés.

### Objectif
Donner à chaque utilisateur un flux de notifications consultable (cloche dans la TopBar + page dédiée), alimenté automatiquement par les événements métier déjà en place (cotisations, versements, rotation, fiabilité).

### Migration SQL — `db/07_phase_f_notifications.sql`

- **ENUM `notification_kind`** : `contribution_due`, `contribution_confirmed`, `payout_released`, `receipt_ready`, `turn_started`, `reliability_changed`, `member_joined`, `invitation_received`.
- **Table `notifications`** :
  - `id`, `user_id`, `kind`, `title`, `body`, `group_id?`, `turn_id?`, `link?`, `payload jsonb`, `read_at?`, `created_at`.
  - Index `(user_id, created_at desc)` et `(user_id) where read_at is null`.
- **RLS** : lecture/maj limitées à `user_id = auth.uid()`. Insertion réservée aux fonctions `security definer`.
- **Helper** `notify(_user_id, _kind, _title, _body, _group_id, _turn_id, _link, _payload)`.
- **Triggers** :
  - `contributions.status = confirmed` → notif au payeur + à l'organisateur.
  - `turns.status` passe à `collecting` → notif aux membres actifs du groupe.
  - `turns.status` passe à `paid` → notif au bénéficiaire (+ "reçu prêt").
  - `user_reliability_scores` : changement de `tier` → notif à l'utilisateur.
  - `group_members` insert (`status = active`) → notif à l'organisateur.
- **RPC** :
  - `mark_notification_read(_id uuid)`
  - `mark_all_notifications_read()`
- **Vue** `my_notifications` (50 plus récentes, `security_invoker`).

### Couche API — `src/lib/api/notifications.ts`
- `listMyNotifications(limit?)`
- `countUnread()`
- `markRead(id)` / `markAllRead()`
- `subscribeToMyNotifications(cb)` via Supabase Realtime (channel sur `notifications` filtré `user_id=eq.<uid>`).

### UI

- **`NotificationBell`** (nouveau, dans `TopBar`) :
  - Icône cloche avec pastille count non lus.
  - Popover avec 10 dernières notifs, bouton "Tout marquer lu", lien "Voir tout".
- **Page `/notifications`** (nouvelle `src/pages/Notifications.tsx`) :
  - Liste complète groupée par jour, filtres "Toutes / Non lues".
  - Click sur une notif → marque lue + navigue vers `link` (groupe, reçu, cotisation).
- **Mise à jour** :
  - `TopBar.tsx` : intègre `NotificationBell`.
  - `DesktopSidebar.tsx` + `BottomNav.tsx` : entrée "Notifications".
  - `App.tsx` : route `/notifications`.
- **Realtime** : hook `useNotifications()` qui s'abonne au montage de l'AppShell, invalide les queries `["notifications"]` et joue un toast léger pour les nouveaux événements.

### Design tokens
- Réutiliser `TIER_CLASSES` / variantes existantes. Pastille non-lue = `bg-primary text-primary-foreground`. Item non lu = fond `bg-primary/5`, liseré gauche `border-l-2 border-primary`.

### Action requise après génération
Exécuter `db/07_phase_f_notifications.sql` dans Supabase, puis confirmer. **Phase G** (paiements réels Djomy) restera la dernière, en attente de l'API.

### Fichiers
- **Créés** : `db/07_phase_f_notifications.sql`, `src/lib/api/notifications.ts`, `src/components/notifications/NotificationBell.tsx`, `src/components/notifications/NotificationItem.tsx`, `src/hooks/useNotifications.ts`, `src/pages/Notifications.tsx`.
- **Édités** : `src/App.tsx`, `src/components/layout/TopBar.tsx`, `src/components/layout/DesktopSidebar.tsx`, `src/components/layout/BottomNav.tsx`, `src/components/layout/AppShell.tsx`.
