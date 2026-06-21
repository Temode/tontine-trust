## Objectif

Finaliser le lot « Mes tontines » avec : modales plus performantes, flux d'invitation post-création complet, validations renforcées (client + API), audit RLS des modales, et nouvelle page de détail tontine avec hero billion-dollar.

## Lot A — Performance des modales

**React Query cache + skeletons précis**
- Introduire `@tanstack/react-query` (déjà présent) pour cacher :
  - `previewByCode(code)` avec `staleTime: 30s`, `gcTime: 5min`, clé `["invitation-preview", code]`
  - `listMyDues()` dans `PayContributionsDialog` avec `staleTime: 15s`
  - `listMyGroups()` partagé entre Dashboard / MyGroups
- Debounce déjà en place dans `JoinGroupDialog` (350ms) — conservé, mais lookup délégué à React Query.
- Skeletons dédiés par état :
  - JoinDialog : skeleton « preview card » (avatar + 3 stats) pendant le lookup, distinct de l'état vide.
  - PayDialog : skeleton « liste de dues » (3 lignes avec montant + date) au lieu du spinner global.
  - CreateDialog : skeleton du panneau « cagnotte preview » pendant le recalcul si async.
- Préchargement : sur ouverture de `PayContributionsDialog`, `prefetchQuery(["my-dues"])` côté provider pour que la modale ouvre déjà remplie.

## Lot B — Flux Invitation post-création

**Nouveau composant `InviteSuccessPanel`** (réutilisé dans `CreateGroupDialog` + page d'invitation) :
- Affiche le code généré (gros, monospace, copiable).
- Lien d'invitation court : `https://<domain>/rejoindre?code=TD-XXXX-XXXX` + bouton copier.
- Bouton « Partager via WhatsApp / SMS / Email » (via Web Share API si dispo, sinon fallbacks `wa.me` / `mailto:` / `sms:`).
- QR code (réutilise `QrCodeSvg`).
- Gestion d'erreurs :
  - Si code expiré → bouton « Générer un nouveau code » → appel `createInvitation()`.
  - Si code révoqué/épuisé → message contextuel + CTA régénérer.
  - Affichage du compteur d'utilisations restantes + date d'expiration.
- Intégration dans `CreateGroupDialog` : après succès, l'écran de confirmation devient ce panneau (au lieu des deux boutons actuels).

## Lot C — Validation client + API

**Politique projet (constants `src/lib/validation/group.ts`)** :
- Cotisation : min 1 000 GNF, max 10 000 000 GNF, multiple de 1 000.
- Membres : 2 à 50.
- Fréquences autorisées : `quotidienne`, `hebdomadaire`, `quinzaine`, `mensuelle`.
- Code invitation : regex `^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$` (déjà en place).

**Client** : Zod schema partagé importé par `CreateGroupDialog`, `JoinGroupDialog`, page CreateGroup.

**API (migration Postgres)** : ajout de `CHECK` constraints sur `groups.contribution_amount` et `groups.max_members`, et garde-fou dans `create_group_with_invitation` + `join_group_with_code` pour refuser :
- Montants hors politique → `INVALID_CONTRIBUTION_BOUNDS`
- Membres hors politique → `INVALID_MAX_MEMBERS_BOUNDS`
- Fréquence inconnue → `INVALID_FREQUENCY`

Erreurs traduites dans `src/lib/api/groups.ts` et `src/lib/api/invitations.ts`.

## Lot D — Audit RLS des modales

Vérification ciblée (lecture seule, aucun changement sauf si écart) :
- `CreateGroupDialog` → `create_group_with_invitation` (SECURITY DEFINER, déjà OK).
- `JoinGroupDialog` → `preview_group_by_code` (requiert auth, déjà OK) + `join_group_with_code`.
- `PayContributionsDialog` → vue `my_dues` / `my_groups_overview` filtrée par `auth.uid()`.

Si une vue expose des colonnes au-delà du périmètre de l'utilisateur connecté, on resserre via `security_invoker=on` ou policy `USING (user_id = auth.uid())`. Action concrète seulement si l'audit révèle un écart — sinon rapport « conforme ».

## Lot E — Page de détail tontine `/tontines/:id`

Le fichier `src/pages/GroupDetail.tsx` existe : on le refonte pour appliquer la doctrine billion-dollar.

**Hero**
- Bandeau gradient sarcelle → fond profond, halo doré subtil.
- Titre (nom du groupe) en font-display 3xl, catégorie en chip, statut (`StatusBadge`).
- Sous-titre : organisateur + date de création + visibilité.
- 4 métriques alignées : Cagnotte par tour, Prochain tour (date + bénéficiaire), Membres actifs / max, Score moyen de fiabilité.

**Barre d'actions** (même doctrine que le hero du Dashboard) :
- « Voir membres » → `/groupes/:id/membres`
- « Gérer contributions » → ouvre `PayContributionsDialog` filtré sur ce groupe
- « Inviter » → ouvre `InviteSuccessPanel` avec code actif
- Menu kebab : Paramètres, Annonces, Chat, Historique paiements, Supprimer

**Corps**
- Tabs (Vue d'ensemble / Membres / Tours / Paiements / Annonces / Chat) — réutilisent les panneaux existants (`MembersAdminPanel`, `TurnsTimeline`, `PaymentsHistoryPanel`, `AnnouncementsPanel`, `GroupChat`).
- Vue d'ensemble : 2 colonnes desktop (timeline des tours + annonces récentes), empilé mobile.

## Implementation order

1. Lot C (validation) — fondations partagées.
2. Lot B (InviteSuccessPanel) — réutilisé en E.
3. Lot A (React Query + skeletons).
4. Lot D (audit RLS).
5. Lot E (page de détail).

## Technical notes

- React Query : `QueryClient` déjà initialisé dans `App.tsx` (à vérifier, sinon l'ajouter).
- Migration SQL minimale : ajout de `CHECK` + raise dans 2 RPC. Pas de changement de schéma destructif.
- Aucun changement d'auth ou de provider.
- Tous les nouveaux composants restent dans `src/components/groups/` ou `src/components/quick-actions/`.
