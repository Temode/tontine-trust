# Audit UX — Tontine Digital

_Date : 20 juin 2026 · Périmètre : application web complète (organisateur, membre, super-admin)._

## TL;DR

L'application a accumulé **30+ routes** et **7 panneaux empilés dans la page Groupe**, sans hiérarchie claire. L'utilisateur passe par 3 systèmes de navigation concurrents (sidebar desktop, bottom-nav mobile, onglets internes). Les libellés mélangent "groupe", "tontine", "cotisation", "paiement", "reçu" sans constance.

**Verdict : labyrinthe confirmé.** Les correctifs P0 ci-dessous sont appliqués dans ce ticket. Les P1/P2 sont à planifier.

---

## 1. Inventaire des points d'entrée

### Sidebar desktop (avant refonte)
`Tableau de bord` · `Mes groupes` · `Mes cotisations` · `Mes reçus` · `Notifications` · `Mon profil` · `Créer un groupe` · `Rejoindre un groupe` = **8 entrées plates**.

### Bottom-nav mobile
`Accueil` · `Groupes` · `Créer` · `Payer` = 4 entrées, **incohérentes avec la sidebar** (`Payer` n'existe pas sur desktop).

### Onglets dans GroupDetail
`overview` · `members` · `rotation` · `swaps` · `auctions` · `reviews` · `chat` · `audit` · `test` = **9 sections**, toutes à plat, sans regroupement organisateur/membre.

### Routes admin plateforme (back-office)
7 routes (`overview`, `suppressions`, `utilisateurs`, `groupes`, `paiements`, `audit`, `integrite`) — OK, périmètre cohérent.

---

## 2. Top 10 frictions

| # | Priorité | Friction | Impact |
|---|----------|----------|--------|
| 1 | **P0** | Vocabulaire incohérent : "groupe" vs "tontine" partout. | Confusion permanente |
| 2 | **P0** | Sidebar = 1 liste plate de 8 items, pas de hiérarchie. | Scan visuel long |
| 3 | **P0** | Mobile/desktop ne montrent pas les mêmes entrées (`Payer` absent sur desktop, `Reçus` absent sur mobile). | Apprentissage cassé entre devices |
| 4 | **P0** | Suppression : 4 clics + 14 jours de vote même quand 0 paiement reçu. | Bloque les tests |
| 5 | **P1** | `GroupDetail` empile 9 sections sans onglet visuel — l'utilisateur scrolle au lieu de naviguer. | Trouver "Discussion" prend ~5 sec |
| 6 | **P1** | Doublons : `/cotisations`, `/recus`, `/paiements`, `Historique des paiements` (panneau in-group). | Personne ne sait où trouver son reçu |
| 7 | **P1** | Le bouton "Payer" dans le bottom-nav mène à la liste de toutes les cotisations dues — pas directement à l'action attendue (régler **celle de maintenant**). | +2 clics |
| 8 | **P1** | Pas d'indicateur "action requise" sur les entrées du menu. | L'organisateur rate ses approbations |
| 9 | **P2** | Le menu admin (super-admin Tontine Digital) est dans la même app que l'usage normal — un super-admin organisateur voit 2 univers visuels différents. | Switching mental |
| 10 | **P2** | `Créer` apparaît à la fois dans la sidebar (Actions rapides) et dans le bottom-nav (FAB central). | Bruit |

---

## 3. Score d'effort par parcours

| Parcours | Clics avant | Clics cible | Statut |
|----------|-------------|-------------|--------|
| Payer ma cotisation du jour | 3 (Sidebar → Cotisations → Payer) | 2 (Sidebar Payer → Payer) | ✅ après renommage |
| Voir qui doit payer | 4 (Sidebar → Groupes → ouvrir groupe → scroller) | 3 (Tontines → groupe → onglet Cotisations) | ⏳ P1 |
| Supprimer un groupe vide | 4 + 14 jours | 3 + validation admin temps réel | ✅ après ce ticket |
| Modifier la configuration | 3 (Groupe → menu → Paramètres) | 3 | déjà OK + banner edit-window |
| Inviter un membre | 3 | 3 | OK |
| Voir mes reçus | 1 (sidebar) | 1 | OK (renommé "Historique & reçus") |

---

## 4. Refonte appliquée dans ce ticket (P0)

### Sidebar desktop : 3 zones au lieu de 2 sections plates

```
ESSENTIEL
  Accueil
  Mes tontines
  Payer

ACTIVITÉ
  Historique & reçus
  Notifications

COMPTE
  Mon profil

ACTIONS RAPIDES
  Créer une tontine
  Rejoindre une tontine
```

### Bottom-nav mobile : renommé en cohérence (`Tontines` au lieu de `Groupes`).

### Suppression "cycle vide" en 1 clic
- `request_group_deletion` détecte automatiquement l'absence de paiement reçu et marque la demande `pending_admin` directement.
- `DeletionPanel` affiche un bandeau ambré "Procédure rapide disponible" avec un bouton **« Demander à Tontine Digital »** qui saute le vote des membres.

### Vocabulaire : "Tontine" partout sur la nav (le mot "Groupe" reste sur le code/DB pour ne rien casser).

---

## 5. À planifier ensuite (P1)

1. **Refondre `GroupDetail`** en 5 onglets fixes : `Vue` · `Membres` · `Cotisations` · `Discussion` · `Administration` (organisateur). Les 4 panneaux dispatch admin (Réglages, Cycles, Permissions, Suppression, Audit) sont fusionnés dans `Administration`.
2. **Fusionner `/cotisations`, `/recus`, `/paiements`** en une seule page `Historique` avec filtres.
3. **Smart-pay** : depuis le bottom-nav "Payer", si une seule cotisation est due → ouvrir directement le modal Djomy. Sinon liste filtrée.
4. **Badges "action requise"** sur les entrées sidebar (notification rouge si demandes d'adhésion, suppression à valider, etc.).

## 6. À planifier ensuite (P2)

- Séparer visuellement le back-office super-admin (sous-domaine `admin.tontine-digitale.app` ou tout au moins thème dédié).
- Onboarding 1ʳᵉ tontine en 3 étapes guidées au lieu du wizard à 5 steps.
- Refonte visuelle : palette `#0D7377` / `#E8AA14` à utiliser de manière plus marquée (CTA, badges actifs) — actuellement très neutre.
