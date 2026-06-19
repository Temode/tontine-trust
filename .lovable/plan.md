
# Test-friendly : minimum 1 000 GNF et fréquence "Quotidienne"

Deux ajustements pour faciliter les tests réels en production Djomy sans dépenser ni attendre.

## 1. Abaisser le minimum de cotisation à 1 000 GNF

Le schéma Zod (`src/lib/validation/group.ts`) accepte déjà `min(1_000)`. Le blocage vient uniquement du bouton "Continuer" de l'étape Paramètres :

- **`src/components/create-group/StepFinancials.tsx`** ligne 35 : changer `draft.contribution >= 10_000` → `draft.contribution >= 1_000`.
- Mettre à jour l'aide/placeholder de l'étape pour indiquer « Min. 1 000 GNF » au lieu de 10 000.
- (Optionnel) Baisser le `DEFAULT_DRAFT.contribution` (`src/components/create-group/types.ts`) de `500_000` à une valeur de test plus modeste comme `5_000`, **uniquement si vous le souhaitez** — sinon on garde 500 000 par défaut pour la prod et l'utilisateur saisit 1 000 pour ses tests.

Côté backend, le `CHECK (contribution_amount > 0)` accepte déjà 1 000, pas de migration nécessaire pour cette partie.

## 2. Ajouter la fréquence "Quotidienne" (1 jour)

L'enum Postgres `group_frequency` ne contient que `hebdomadaire | quinzaine | mensuelle`. Il faut l'étendre proprement.

### 2a. Migration SQL (deux étapes obligatoires pour ajouter une valeur d'enum)
- **Migration A (prelude)** : `ALTER TYPE public.group_frequency ADD VALUE IF NOT EXISTS 'quotidienne';` dans sa propre transaction (Postgres interdit d'utiliser une nouvelle valeur d'enum dans la même transaction que son ajout).
- **Migration B (logique)** : mettre à jour la fonction RPC `start_cycle` (`db/03_phase_b_rotation.sql`, lignes 228-232) pour ajouter `when 'quotidienne' then 1`. Idem partout où on case/switch sur la fréquence côté DB (à scanner pour s'assurer qu'il n'y en a pas d'autres).

### 2b. Frontend
- **`src/lib/types.ts`** : ajouter `"Quotidienne"` au type `Frequency`.
- **`src/lib/validation/group.ts`** : ajouter `"Quotidienne"` à l'enum Zod ligne 23.
- **`src/components/create-group/types.ts`** :
  - `FREQUENCY_DAYS` → ajouter `Quotidienne: 1`.
  - Pas besoin de toucher `DEFAULT_DRAFT.frequency` (reste `"Mensuelle"`).
- **`src/components/create-group/StepFinancials.tsx`** : ajouter en tête de la liste des fréquences `{ id: "Quotidienne", label: "Quotidienne", cadence: "Tous les jours" }` (avec mention « Idéal pour tester » si vous voulez).
- **`src/lib/api/groups.ts`** (et autres mappers) : si une fonction map le label FR vers le label DB minuscule (`Hebdomadaire` → `hebdomadaire`), ajouter l'entrée correspondante. Je vérifierai à l'implémentation.

### 2c. Affichage
- `formatHorizon` et `cycleLabel` dans `types.ts` gèrent déjà les durées en jours, donc l'affichage d'un cycle de 12 jours (12 membres × 1 jour) sera correct (« 12 jours »).

## Étapes d'exécution
1. Migration A (prelude enum) — 1 ligne SQL.
2. Migration B (RPC `start_cycle` + recherche d'autres `case frequency`).
3. Édits frontend listés au §1 et §2b/2c.
4. Test manuel : créer un groupe « Test paiement » avec 3 membres, 1 000 GNF, fréquence Quotidienne → lancer le cycle → faire un paiement Djomy live de 1 000 GNF → vérifier le passage à `succeeded`.

## Hors-scope
- Pas de changement de l'UI de paramètres existants (`Group Settings`) au-delà de l'ajout de l'option Quotidienne dans le sélecteur si pertinent.
- Pas de modification des montants ou fréquences des groupes déjà créés.
