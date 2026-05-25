# Audit Dashboard & refonte MVP

## Audit du dashboard actuel

Le dashboard actuel (`src/pages/Dashboard.tsx`) affiche **12 composants** alimentés à 100% par `mock-data`. Pour un MVP centré sur **tontine digitale automatisée + traçabilité + score de fiabilité**, c'est largement surdimensionné.

### Ce qui est inutile pour le MVP

| Bloc | Composant | Raison du retrait |
|---|---|---|
| Solde total tontines | `PrimaryBalanceCard` | Pas de wallet/solde en MVP (paiements simulés) |
| Cotisations effectuées (KPI) | `StatTile` out | Doublon avec « État cotisations » |
| Cagnottes reçues (KPI) | `StatTile` in | Pas de versements réels en V1 |
| Transactions récentes + filtres | `TransactionsTable` | Phase D (paiements) — pas encore de vraies tx |
| Distribution par groupe | `DistributionCard` | Analytique avancée, hors MVP |
| État cotisations live (organisateur) | `MemberStatusGrid` | Doit vivre dans `/groupes/:id`, pas le dashboard |
| Pay card + Quick links | `PayCard`, `QuickLinks` | Redondant avec sidebar + bouton créer |
| Échéances (mock) | `DeadlinesList` | Garder mais brancher sur vraies données quand cycles seront prêts |

### Ce qu'on garde (utile MVP)

- **Salutation + CTA principal** (créer / rejoindre un groupe)
- **Mes groupes actifs** — liste compacte branchée sur `listMyGroups()` (déjà fait Phase B)
- **Score de fiabilité** — pilier du concept (mock acceptable, sera calculé Phase D)
- **Prochaines échéances** — placeholder « Aucune échéance » jusqu'à Phase C

## Nouvelle structure proposée (MVP)

```text
┌─────────────────────────────────────────────┐
│ TopBar : "Bonjour {prenom}"                 │
│ Actions : [Créer un groupe] [Rejoindre]     │
├─────────────────────────────────────────────┤
│ 3 KPI simples (données réelles)             │
│  • Groupes actifs    • Tour à venir         │
│  • Score fiabilité                          │
├──────────────────────────┬──────────────────┤
│ Mes groupes (réel)       │ Score fiabilité  │
│ liste 5 derniers + CTA   │ (carte simple)   │
│ "Voir tout"              │                  │
│                          │ Prochaines       │
│                          │ échéances (vide) │
└──────────────────────────┴──────────────────┘
```

3 KPI réels :
- **Groupes actifs** = `listMyGroups()` count
- **Prochain tour** = placeholder « À venir » (Phase C)
- **Score fiabilité** = mock 100% jusqu'à Phase D

## Détails techniques

### Fichiers modifiés
- `src/pages/Dashboard.tsx` → réécriture, ~80 lignes au lieu de 186
- Suppression des imports : `PrimaryBalanceCard`, `StatTile`, `TransactionsTable`, `TransactionFilters`, `DistributionCard`, `MemberStatusGrid`, `PayCard`, `QuickLinks`, `RoleGuard`, `PaymentModal`, mock `transactions`, `groupDistribution`, `liveMembersStatus`, `upcomingDeadlines`, `getStats`.
- Plus de `RoleGuard` dans dashboard (la vue organisateur déménage dans `/groupes/:id`)

### Fichiers conservés intacts
- `SectionCard`, `GroupRow`, `DeadlinesList`, `ReliabilityCard` réutilisés
- Composants supprimés du dashboard restent disponibles ailleurs (Cotisations, Historique, GroupDetail)

### Données
- `useQuery(['groups','mine'], listMyGroups)` déjà branché Phase B → réutilisé
- KPI "Groupes actifs" calculé à partir du même `data`
- Score fiabilité : mock `92%` en attendant Phase D

### Hors périmètre de ce plan
- Brancher échéances sur vrais cycles → Phase C
- Brancher score sur vraies cotisations → Phase D
- Page `/cotisations`, `/rotations`, `/historique` inchangées

## Validation

1. Dashboard se charge sans aucune référence aux mocks `transactions`, `liveMembersStatus`, etc.
2. Compteur "Groupes actifs" reflète la BDD réelle
3. Liste "Mes groupes" affiche les vrais groupes (ou état vide CTA)
4. Aucune régression sur les autres pages

Dis « go » pour que je passe en build mode et réécrive le dashboard.
