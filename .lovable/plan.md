# Audit du menu et des pages — préparation au lancement MVP

## Constat

Le menu (`DesktopSidebar` + `BottomNav`) expose **13 routes**, dont **10 pages encore alimentées à 100 % par `mock-data`**. Pour un MVP centré sur **création de groupe + invitation + rotation auto + traçabilité + score de fiabilité**, c'est trop. L'utilisateur clique partout et tombe sur des écrans factices → confusion, non livrable.

Pilier déjà connecté à la BDD (Phase B) : `Dashboard`, `MyGroups`, `GroupDetail`, `CreateGroup`, `JoinGroup`, `InviteMembers`.

## Audit page par page

| Route | Fichier | État | Décision MVP |
|---|---|---|---|
| `/dashboard` | Dashboard.tsx | Réel (Phase B) | **Garder** |
| `/groupes` | MyGroups.tsx | Réel | **Garder** |
| `/groupes/:id` | GroupDetail.tsx | Partiel réel | **Garder** |
| `/nouveau` | CreateGroup.tsx | Réel | **Garder** |
| `/rejoindre` | JoinGroup.tsx | Réel (RPC) | **Garder** |
| `/inviter` | InviteMembers.tsx | Réel | **Fusionner dans `/groupes/:id`** (déjà accessible via le détail) → retirer du menu |
| `/profil` | Profile.tsx | Mock (KYC, mandats, sécurité…) | **Garder en version minimale** (nom, téléphone, déconnexion, score). Retirer KycPanel, MandatesPanel, DangerZone, ReliabilityBreakdown, TrackRecordStrip, ProfileActivity. |
| `/cotisations` | Contributions.tsx | 100 % mock | **Retirer** (Phase D — paiements) |
| `/rotations` | Rotations.tsx | 100 % mock | **Retirer** (Phase C — données pas prêtes) |
| `/historique` | History.tsx | 100 % mock | **Retirer** (Phase D) |
| `/calendrier` | Calendar.tsx | 100 % mock | **Retirer** (post-MVP) |
| `/notifications` | Notifications.tsx | 100 % mock | **Retirer** (notifications in-app pas encore branchées) |
| `/parametres` | Settings.tsx | 100 % mock (abonnement, API, conformité…) | **Retirer** (hors MVP) |

## Menu cible (MVP)

```text
Menu principal
  • Tableau de bord     /dashboard
  • Mes groupes         /groupes
  • Mon profil          /profil

Actions rapides
  • Créer un groupe     /nouveau
  • Rejoindre un groupe /rejoindre
```

`BottomNav` mobile aligné : Accueil · Groupes · Créer (FAB) · Profil (4 entrées au lieu de 5 ; retrait d'Historique).

Les routes retirées du menu **restent dans `App.tsx`** pour ne rien casser, mais ne sont plus accessibles via la navigation. On les supprimera réellement plus tard quand on saura quoi en faire — ou on peut les supprimer maintenant si tu préfères un nettoyage radical (voir Question).

## Travaux concrets

1. **`DesktopSidebar.tsx`** — réduire `sections` aux 5 entrées ci-dessus. Retirer badge mock `3`, dot notifications, `currentUser` mock du bas (utiliser `useAuth` réel).
2. **`BottomNav.tsx`** — remplacer Historique par Profil ; garder 5 slots (Accueil, Groupes, Créer FAB, Profil … 4e ?). À trancher : 4 entrées suffisent (Accueil, Groupes, Créer, Profil).
3. **`Profile.tsx`** — réécriture light : carte identité (nom, téléphone, email depuis `useAuth`), score fiabilité (mock 100 %), bouton « Se déconnecter ». Supprimer imports KYC/mandats/danger/activity.
4. **`App.tsx`** — option A : garder toutes les routes (sécurité) ; option B : supprimer les routes retirées + supprimer les fichiers `Calendar.tsx`, `Contributions.tsx`, `Rotations.tsx`, `History.tsx`, `Notifications.tsx`, `Settings.tsx`, `InviteMembers.tsx`. Recommandé : **option B** pour livrer propre.
5. **`InviteMembers`** — reste accessible depuis `GroupDetail` (bouton « Inviter ») via une modale ou redirection ; à confirmer.

## Détails techniques

- Pas de migration BDD nécessaire.
- Pas de nouveau composant à créer.
- Suppressions de fichiers en option B :
  - `src/pages/{Calendar,Contributions,Rotations,History,Notifications,Settings,InviteMembers}.tsx`
  - Dossiers `src/components/{calendar,contributions,rotations,history,notifications,settings,invite-members}/` (sauf si réutilisés ailleurs — à vérifier)
- `mock-data.ts` allégé en conséquence (à faire en dernier).

## Validation

1. Le menu n'expose que des pages réelles et fonctionnelles.
2. Aucun clic ne mène à un écran 100 % mock.
3. Build vert, aucune route cassée.
4. App prête à être présentée comme MVP.

## Questions avant build

- **Option A (sûr) ou B (radical)** pour les pages retirées ? Je recommande **B**.
- `InviteMembers` : transformer en modale dans `GroupDetail`, ou laisser une route `/groupes/:id/inviter` non listée au menu ?

Dis « go B + modale » (ou ta variante) pour que je passe en build.
