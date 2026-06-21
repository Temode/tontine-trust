## Objectif

Atteindre le niveau de polish de Paxefy en travaillant **une page à la fois** (revue UX ciblée, validée avant de passer à la suivante), tout en conservant la palette Tontine (sarcelle #0D7377 + or #E8AA14). En parallèle, rendre les popovers d'onboarding plus **pédagogiques et orientés action**.

---

## Partie A — Onboarding plus pédagogique (fait dans la foulée)

Réécriture des 5 étapes dans `src/components/tour/steps.ts` selon le schéma :
**Titre orienté action** → **Où regarder** (pointeur visuel) → **Quoi faire** → **Et ensuite**.

Exemple pour l'étape « Accueil » :
- Avant : *« Votre tableau de bord : ce que vous devez payer, votre prochain tour, vos tontines actives. »*
- Après :
  > **Commencez ici chaque jour**
  > 👉 Cliquez sur **Accueil** dans le menu de gauche.
  > Vous y verrez en haut **ce que vous devez payer aujourd'hui**, puis vos tontines actives.
  > *Astuce : si une carte rouge s'affiche, c'est une cotisation à régler en priorité.*

Même structure appliquée aux 5 étapes (Bienvenue, Accueil, Mes tontines, Payer, Notifications) + ajout d'un libellé bouton plus clair : « Suivant → » devient **« Étape suivante »**, « Passer » devient **« Passer la visite »**. Ajout d'un compteur « Étape 2 / 5 » déjà présent — on le rendra plus visible.

Aucune modif de la mécanique du tour, uniquement le contenu (`steps.ts`) et 2-3 libellés dans `GuidedTour.tsx`.

---

## Partie B — Revue UX page par page

Ordre proposé selon l'usage réel (du plus consulté au plus rare) :

```text
1. Accueil (/dashboard)          ← on commence ici
2. Mes tontines (/groupes)
3. Payer (/cotisations)
4. Historique & reçus (/recus)
5. Mon profil (/profil)
6. Détail d'un groupe (/groupes/:id)
```

**Règle du jeu** : on traite **une seule page par tour**. À chaque page :

1. Je liste les frictions UX observées (hiérarchie, densité, vides, états de chargement, libellés, mobile).
2. Je propose 3-5 corrections concrètes (avant/après textuel + composants impactés).
3. Tu valides → j'implémente → tu vois le résultat → on passe à la page suivante.

### Étape 1 — Page Accueil (`src/pages/Dashboard.tsx`)

Axes de revue prévus :
- **Hiérarchie verticale** : la première chose vue doit être « as-tu quelque chose à payer aujourd'hui ? » (zéro scroll).
- **Empty state** quand l'utilisateur n'a aucune tontine (aujourd'hui : carte vide peu engageante) → CTA double « Créer une tontine » + « Rejoindre via code ».
- **Carte de cotisation due** : passage au style Paxefy (bord gauche accent, montant en gros, date relative « dans 2 jours », bouton primaire « Payer maintenant »).
- **Skeletons** pendant le chargement plutôt que spinners.
- **Mobile** : vérifier que les cartes ne débordent pas à 360px, que le bouton de paiement reste accessible au pouce.
- **Formatage des montants** : `120 000 GNF` (espace insécable) partout.

Livrables Étape 1 :
- Modification de `src/pages/Dashboard.tsx`
- Création de `src/components/ui/EmptyState.tsx` (réutilisable pour les pages suivantes)
- Création de `src/components/dashboard/DueCard.tsx` (carte cotisation due)
- Ajustements mineurs dans `src/lib/format.ts` si besoin (montants, dates relatives)

Aucun changement de palette, de typo, de routes, ni de backend.

---

## Ce qui n'est PAS dans ce plan

- Les étapes 2 à 6 (autres pages) : seront chacune un nouveau plan validé séparément.
- Couleurs, fonts, logique métier, base de données, Djomy, admin.
- Refonte de la sidebar / topbar (déjà faite à l'itération précédente).

---

## Question implicite

Je démarre par **(A) la réécriture pédagogique des popovers + (B) la revue UX de la page Accueil** dans le même tour. Si tu préfères les séparer (juste A d'abord, ou juste B d'abord), dis-le moi avant d'approuver.
