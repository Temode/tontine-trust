# Plan — Écran dédié "Co-organisateurs"

Sortir la gestion des co-organisateurs du panneau membres global et lui donner une page autonome qui rend lisibles les 9 permissions granulaires et les actions disponibles selon le rôle de l'utilisateur connecté.

## Périmètre

Frontend uniquement — toute la mécanique SQL (`db/33_admin_permissions.sql`, helpers `grant_admin_permissions`, `revoke_admin_permissions`, `has_admin_permission`, vue `group_admin_permissions_view`) et l'API (`src/lib/api/adminPermissions.ts`) sont déjà en place et inchangées.

## Nouvelle page

`src/pages/GroupCoOrganizers.tsx` montée sur `/groupes/:id/co-organisateurs` (route protégée, dans `AppShell`, ajoutée à `src/App.tsx` en lazy import).

Structure :

1. **En-tête** — bouton retour vers le groupe, titre "Co-organisateurs", sous-titre rappelant le nom du groupe, badge rôle du visiteur (Organisateur / Co-organisateur / Membre).
2. **Bandeau d'explication** — court paragraphe : "Un co-organisateur peut aider à gérer le groupe avec des droits que vous choisissez. Vous pouvez retirer ces droits à tout moment."
3. **Liste des co-organisateurs actuels** (`listAdminPermissions(groupId)`) — une carte par personne avec :
   - avatar + nom + téléphone masqué selon préférence,
   - date d'attribution,
   - **grille des 9 permissions** (`ADMIN_PERMISSION_KEYS`) avec icône check/cross + libellé `ADMIN_PERMISSION_LABELS`, regroupées en 3 sections visuelles :
     - *Membres* (approve, suspend, kick)
     - *Opérations* (edit_settings, manage_invitations, confirm_payments, pause_cycle)
     - *Communication & finance* (send_announcements, waive_penalty)
   - menu d'actions : "Modifier les permissions" (ouvre un Dialog avec 9 `Switch`) et "Retirer le rôle" (AlertDialog de confirmation → `revokeAdminPermissions`).
4. **Section "Promouvoir un membre"** (visible uniquement si `isOwner`) — `Select` listant les membres `active` non encore co-organisateurs, puis le même Dialog de permissions, validation via `grantAdminPermissions`.
5. **Empty state** quand aucun co-organisateur — illustration légère + bouton "Promouvoir un membre".

## Règles d'affichage selon le rôle

Calculées côté frontend à partir de `group.created_by` et de la ligne `group_admin_permissions_view` du visiteur :

- **Organisateur (`isOwner`)** : voit tout, peut promouvoir, modifier, révoquer n'importe qui, transférer la propriété (lien vers le panneau existant dans `MembersAdminPanel`).
- **Co-organisateur** : voit la liste complète + ses propres permissions surlignées ("Vous"). Les actions modifier/révoquer sont masquées (uniquement l'organisateur peut éditer les permissions d'un autre admin).
- **Membre simple** : redirection automatique vers `/groupes/:id` avec toast "Accès réservé à l'organisateur".

## Composant réutilisable

`src/components/group/PermissionsMatrix.tsx` — affiche la grille 3 sections × N permissions, mode `readonly` (icônes) ou `editable` (Switch). Utilisé à la fois dans la carte de liste et dans le Dialog d'édition. Évite la duplication avec le dialog existant de `MembersAdminPanel`.

## Intégration

- **`src/App.tsx`** : ajouter la route `/groupes/:id/co-organisateurs`.
- **`src/pages/GroupSettings.tsx`** : le bloc "Co-organisateurs" actuel (intégré dans `MembersAdminPanel`) reste mais une bannière "Gérer sur la page dédiée →" pointe vers la nouvelle route. Pas de suppression de l'existant pour éviter toute régression.
- **`src/pages/GroupDetail.tsx`** : ajouter dans le menu/quick-actions du groupe un raccourci "Co-organisateurs" visible aux owners + admins.

## Détails UI (design system existant)

- Bleu sarcelle pour les permissions actives, gris hairline pour inactives.
- Or (#E8AA14) pour le badge "Organisateur principal" / icône `Crown`.
- Cards `SectionCard`, Switch shadcn, Dialog shadcn, AlertDialog shadcn.
- Mobile-first : grille permissions en 1 colonne <640px, 2 colonnes ≥640px.

## Fichiers touchés

```text
+ src/pages/GroupCoOrganizers.tsx
+ src/components/group/PermissionsMatrix.tsx
~ src/App.tsx                 (route + lazy import)
~ src/pages/GroupSettings.tsx (bannière "voir l'écran dédié")
~ src/pages/GroupDetail.tsx   (lien rapide)
```

Aucune migration, aucun changement API, aucun retrait de fonctionnalité existante.
