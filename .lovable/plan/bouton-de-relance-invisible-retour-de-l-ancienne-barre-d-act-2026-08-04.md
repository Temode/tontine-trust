# Bouton de relance invisible + retour de l'ancienne barre d'actions

## Ce qui se passe (vérifié)

1. **Le bouton « Préparer la relance » n'apparaît jamais** — ce n'est pas un problème de placement.
   La fonction serveur `renewal_status`, qui alimente tout l'encart de relance, contient une
   erreur : elle joint la table des profils sur une colonne `user_id` qui n'existe pas
   (la colonne s'appelle `id`). L'appel échoue donc systématiquement, l'encart reçoit une
   erreur au lieu de données et se cache complètement — pour l'organisateur comme pour les membres.
   Le groupe « Epargne » remplit pourtant toutes les conditions : 3 membres actifs,
   les 3 tours réglés, vous êtes bien l'organisateur.

2. **La barre d'actions** a été remplacée par un bouton unique « Actions » avec menu déroulant,
   alors que la version précédente affichait les actions directement (Voir membres,
   Gérer contributions, Inviter, Paramètres, Rappels).

## Correctifs

### 1. Réparer la relance de cycle (base de données)
- Corriger `renewal_status` : jointure sur la bonne colonne de la table des profils.
- Vérifier au passage les autres fonctions de relance (`list_renewal_votes`,
  `dispatch_renewal_notification`) pour la même erreur de jointure et les corriger si besoin.

### 2. Rendre l'encart de relance robuste
- Dans le panneau de relance, si l'appel serveur échoue, afficher un message d'erreur discret
  avec bouton « Réessayer » au lieu de disparaître silencieusement.
- Pour l'organisateur d'un cycle terminé, afficher l'encart « Préparer la relance » même si
  les données annexes ne sont pas disponibles.

### 3. Restaurer l'ancienne barre d'actions
Revenir à la barre en boutons visibles, dans cet ordre :
`Voir membres` (primaire) · `Gérer contributions` · `Inviter` — et à droite `Paramètres` · `Rappels`.
- Suppression du menu déroulant « Actions ».
- Conservation du bouton « Payer ma cotisation » en action primaire quand une cotisation est due.
- Repli en défilement horizontal sur mobile pour rester lisible.

## Détails techniques
- Migration SQL : `CREATE OR REPLACE FUNCTION public.renewal_status(uuid)` avec
  `LEFT JOIN public.profiles p ON p.id = v.user_id`.
- `src/components/group/RenewalPanel.tsx` : gérer `statusQ.isError` (fallback organisateur + retry).
- `src/pages/GroupDetail.tsx` : remplacer le bloc `DropdownMenu` « Actions » (lignes ~462-520)
  par la rangée de boutons d'origine.
