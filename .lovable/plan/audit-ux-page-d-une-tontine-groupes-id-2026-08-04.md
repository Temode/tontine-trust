# Audit UX — page d'une tontine (`/groupes/:id`)

## Le problème signalé : le bouton de lancement est introuvable

Vérifié dans le code :

- Le bouton **« Démarrer le cycle »** ne s'affiche que si le statut du groupe est `brouillon` ou `ouvert` et qu'il y a au moins 2 membres actifs.
- L'encart **« Relancer une nouvelle tontine »** ne s'affiche que si le statut est `terminé`.

Sur la capture, le groupe est marqué **ACTIF** alors que la page indique en bas « Cycle non démarré · Aucun tour planifié ». Dans cet état intermédiaire, **aucun des deux blocs n'a le droit de s'afficher** : c'est un trou dans la logique, pas un problème de style. À vérifier en base avant de corriger (le groupe est-il réellement `active` sans cycle ni tours ?), puis traiter la cause.

## Les autres frictions relevées (par rapport à `docs/DESIGN_DOCTRINE.md`)

1. **Aucune action primaire unique** — la barre d'actions aligne 5 boutons ("Voir membres", "Gérer contributions", "Inviter", "Paramètres", "Rappels") de poids visuel proche. La doctrine impose une seule action primaire par écran.
2. **L'info critique est sous la ligne de flottaison** — l'action réellement urgente (signer le contrat, démarrer le cycle) est noyée sous le héros, la barre d'actions puis plusieurs encarts.
3. **Empilement de panneaux** — Rétentions, Invitations, Annonces, Forfait SMS s'affichent tous à plat avant les onglets ; les onglets (Aperçu, Membres, Rotation…) arrivent en toute fin de page alors qu'ils sont la vraie navigation.
4. **Incohérence de données affichée** — « Progression du cycle 100 % » avec « Aucun tour planifié » : deux messages contradictoires sur le même écran.
5. **Bandeau contrat peu lisible** — l'action bloquante ("Signer le contrat") est traitée comme un encart ordinaire, sans hiérarchie ni lien avec le démarrage du cycle.
6. **Micro-typographie trop petite** — beaucoup de `text-[11px]` en série (codes, hints, badges) : dense, peu respirant, à l'inverse de la règle "beaucoup d'air".

## Ce que je propose de faire

### 1. Rendre le lancement toujours visible (priorité)
- Un **encart unique de démarrage** en haut de page, juste sous le héros, dès qu'aucun cycle n'est en cours — quel que soit le statut (`brouillon`, `ouvert`, `actif sans tours`, `terminé`).
- Cet encart affiche l'état réel et ce qui bloque : nombre de membres manquants, signatures de contrat en attente, ou « prêt à démarrer ».
- Une seule action : **« Démarrer le cycle »** (ou **« Préparer le nouveau cycle »** si le cycle précédent est terminé), désactivée avec explication tant qu'un prérequis manque — jamais masquée.
- Le bandeau contrat est fusionné dans cet encart comme étape 1 de la checklist de démarrage.

### 2. Hiérarchiser la page
- Barre d'actions réduite à **une action primaire** contextuelle + un menu « … » pour Paramètres, Rappels, Co-organisateurs, Inviter.
- **Onglets remontés** juste sous l'encart d'état : le contenu long (Invitations, Annonces, SMS, Rétentions) passe dans les onglets correspondants au lieu de s'empiler.
- Corriger l'affichage de la progression quand aucun tour n'existe (afficher « — » plutôt que 100 %).

### 3. Respirer
- Padding des encarts porté à `p-5`/`p-6`, montants en `tabular-nums`, suppression des badges ALL CAPS superflus, taille minimale de texte secondaire à `text-xs`.

## Détails techniques

- `src/pages/GroupDetail.tsx` : remplacer `canStart` par un helper `getCycleLaunchState(grp, activeMembers, turns, contract)` qui renvoie `{ mode: "start" | "renew" | "running", blockers: string[] }` ; extraire un composant `CycleLaunchCard`.
- `src/components/group/RenewalPanel.tsx` : la condition `if (!st.open && !(cycleFinished && isOrganizer)) return null;` est assouplie pour couvrir « cycle terminé » au sens large (`completed`, `archived_at`, ou actif sans tours restants).
- Vérification préalable en base sur ce groupe (`statut`, cycles, tours) pour confirmer l'état incohérent avant de figer la logique.
- Aucune modification de la logique métier serveur (démarrage, rotation, pot) : uniquement affichage et conditions d'affichage.
