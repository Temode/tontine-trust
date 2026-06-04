# Plan de correctifs — Invitation & adhésion aux groupes

Objectif : rendre opérationnel le flux d'invitation/adhésion identifié par l'audit, dans l'ordre de sévérité.

## 1. Bloquants saisie & lien (frontend)

**`src/components/join-group/CodeEntryHero.tsx`**
- Corriger `maxLength={11}` → `maxLength={12}` (format `TD-XXXX-XXXX` = 12 caractères).
- Lire `?code=` via `useSearchParams` au montage, auto‑formater et pré‑remplir l'input. Si le code est complet, déclencher automatiquement `handleJoin()`.

**`src/components/groups/InvitePanel.tsx`**
- Remplacer le lien `https://tontine.digital/join/<code>` par `${window.location.origin}/rejoindre?code=<code>` (route réelle, déjà routée dans `App.tsx`).

## 2. Bloquant base de données (membres & pot à 0)

**Nouveau `db/09_fix_membership_trigger.sql`** (migration) :
- Aligner l'enum `member_status` avec le frontend : ajouter la valeur `'pending'` si absente.
- Recréer le trigger `on_group_created` (idempotent : `drop` + `create`) qui insère le créateur dans `group_members` avec `role='organisateur'`, `status='active'`, `position=1`.
- Réexécuter le backfill de `db/08_backfill_organizer_membership.sql` pour les groupes existants.

## 3. Workflow d'approbation

**`join_group_with_code` RPC** (migration SQL) :
- Lire `groups.require_manual_approval` (ou règle équivalente déjà présente dans le schéma). Si vrai → insérer le nouveau membre avec `status='pending'` au lieu de `'active'`.
- Créer une notification pour l'organisateur (`type='member_request'`).
- À l'`approve_member`, créer une notification pour le demandeur (`type='member_approved'`).

## 4. Sécurité RLS sur `invitations`

Migration SQL :
- Restreindre `select` sur `invitations` aux organisateurs du groupe uniquement (pas les autres membres).
- La validation d'un code par un invité non‑membre passe exclusivement par la RPC `security definer` `join_group_with_code` (pas de `select` direct côté client).
- Vérifier : `insert` réservé aux organisateurs, `update status='revoked'` réservé aux organisateurs.

## 5. Robustesse UI

**`src/pages/GroupDetail.tsx`** : si la requête groupe renvoie vide (RLS), afficher un écran d'erreur 403/404 explicite avec retour, au lieu d'un « Chargement… » infini.

**`src/pages/JoinGroup.tsx`** : retirer les blocs basés sur `mock-data` (`directoryGroups`, `myApplications`, `getJoinStats`) ou les remplacer par un état vide honnête (« Annuaire en cours d'ouverture »). Ne laisser que `CodeEntryHero` actif.

## 6. Vérification

Après application :
- `psql` : vérifier qu'un nouveau groupe insère bien 1 ligne `group_members` (organisateur, active).
- Browser : test bout en bout avec deux comptes — code + lien — observer notifications + compteur membres + flux approbation.

## Hors scope

Paiements Orange/MTN, performance, refonte annuaire public (Phase ultérieure).

## Action requise

Passer en **mode Build** pour exécuter les migrations SQL et appliquer les patchs.
