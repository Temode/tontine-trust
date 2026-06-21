## Diagnostic

1. **Cache navigateur** : ta capture montre un sidebar plus ancien que ce qui est dans le code. Un `Ctrl + Shift + R` sur ton onglet localhost le rafraîchira (déjà une nette simplification).
2. **Mais le fond reste vrai** : depuis le MVP simplifié de mai, le dashboard et le menu ont regrossi. On va revenir à un état clair, MVP-ready.

## Principe directeur

Un utilisateur n'a besoin de répondre qu'à **trois questions** en ouvrant l'app :
1. Combien je dois et à qui ?
2. Quand est mon prochain tour ?
3. Où en sont mes tontines ?

Tout le reste est secondaire et doit s'effacer.

## 1. Sidebar simplifié — 5 entrées au lieu de 8

```
Accueil        → /dashboard      (vue d'ensemble + actions)
Mes tontines   → /groupes        (liste + créer/rejoindre depuis l'empty state)
Payer          → /cotisations    (cotisations à régler)
Historique     → /recus          (paiements passés + reçus)
Mon profil     → /profil         (sous-menu : notifications, confidentialité)
```

Supprimé du menu (les fonctionnalités restent accessibles, juste plus dans la nav principale) :
- « Notifications » → déplacée en **icône cloche dans le TopBar** (déjà présente)
- « Créer une tontine » + « Rejoindre une tontine » → bouton **« + Nouvelle tontine »** dans le TopBar et CTA dans l'empty state de /groupes
- Section « Actions rapides » → supprimée (redondante)

## 2. Dashboard recentré — 3 blocs au lieu de 6+

```
┌────────────────────────────────────────────────────────────┐
│  Bonjour Moussa 👋                                          │
│  Voici ce qui demande ton attention aujourd'hui.            │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  À PAYER     │  │ PROCHAIN TOUR│  │   FIABILITÉ  │    │
│  │  100 000 GNF │  │   12 juil.   │  │     98 %     │    │
│  │  [Payer]     │  │  Aïssatou    │  │   Très bon   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
├────────────────────────────────────────────────────────────┤
│  MES TONTINES (3 actives)                  [Voir tout →]  │
│  • Famille Diallo · prochain : 12 juil.                    │
│  • Collègues bureau · prochain : 20 juil.                  │
│  • Investissement 2026 · à initier                         │
└────────────────────────────────────────────────────────────┘
```

Supprimés du dashboard :
- KPI redondants (« Paiements réussis », « Provider Djomy/OM/MTN/Carte »)
- `RecentAnnouncementsCard` (déplacée dans la cloche notifications)
- `DuesCard` + `UpcomingTurnsCard` séparées (fusionnées dans les 3 KPI cliquables)

Si tu cliques sur **« À payer »** → tu arrives directement sur `/cotisations` filtré sur les cotisations dues. Plus de double affichage.

## 3. Page « Payer » (/cotisations) — nettoyage

- Garder uniquement les **cotisations dues** (par défaut)
- Onglet secondaire « En cours » montrant les paiements initiés non confirmés (avec un bouton **« Reprendre »** ou **« Annuler »** pour les 3 résidus de test que tu as actuellement)
- Retirer les triples KPI en haut (À payer / Paiements réussis / Provider) — déjà dans le dashboard
- Garder le titre + sous-titre, c'est tout

## 4. Bonus : nettoyer les paiements de test orphelins

Tu as 3 paiements `initiated` jamais confirmés (issus de nos tests Djomy). On ajoute un job ou une RPC qui les passe en `cancelled` automatiquement après 30 min, ET tu peux les annuler manuellement depuis l'onglet « En cours ».

## Hors-scope

- Aucun changement sur le back-office admin (`/admin/*`)
- Aucun changement sur les flux paiement Djomy (qui marchent maintenant)
- Aucun changement sur le design system / couleurs / typo — on garde le visuel actuel, on retire seulement du contenu
- Aucune migration DB

## Fichiers à modifier

- `src/components/layout/DesktopSidebar.tsx` — 5 entrées au lieu de 8
- `src/components/layout/BottomNav.tsx` — alignement mobile
- `src/components/layout/TopBar.tsx` — ajouter bouton « + Nouvelle tontine »
- `src/pages/Dashboard.tsx` — passer de 6 cartes à 3 KPI + 1 liste tontines
- `src/pages/MyContributions.tsx` — retirer les 3 KPI redondants, ajouter onglet « En cours »
- `src/pages/MyGroups.tsx` — empty state avec les CTA Créer/Rejoindre

## Validation

Après les changements :
- Le menu de gauche tient sur **5 lignes**
- Le dashboard tient sans scroll sur un écran 13"
- Tu peux aller de l'accueil au paiement en **2 clics maximum**
