## Objectif
1. **Corriger** le bug critique : la page de création de groupe devient blanche dès que l'utilisateur saisit trop de caractères
2. **Redessiner** le parcours de création (actuellement trop "enfantin") avec un ton professionnel adapté à un produit financier réel
3. **Dérouler** le scénario de test E2E Alice → Bob sur un **nouveau groupe** créé proprement via l'UI

## Phase 1 — Diagnostic & fix du crash "page blanche"

Investigation des fichiers du wizard :
- `src/pages/CreateGroup.tsx`
- `src/components/create-group/StepIdentity.tsx` (champs nom/description — suspect n°1)
- `src/components/create-group/StepFinancials.tsx` (montants — suspect n°2 si `Number.parseInt` sur valeurs vides ou trop grandes)
- `src/components/create-group/StepRules.tsx`, `StepInvitations.tsx`, `StepReview.tsx`, `TermSheet.tsx`

Hypothèses prioritaires :
- `RangeError` / `NaN` sur un `Intl.NumberFormat` ou `formatGNF()` quand le champ devient une chaîne non-numérique
- Erreur non capturée dans un `useMemo` qui recalcule l'aperçu (TermSheet) à chaque frappe
- Un `.toFixed()` / `.toLocaleString()` sur `undefined`
- Validation Zod qui throw au lieu de retourner un message

Correctifs :
- Ajouter un `ErrorBoundary` local autour du wizard (évite l'écran blanc complet)
- Guards défensifs sur les parseurs numériques (`Number.isFinite`)
- Limites `maxLength` cohérentes sur les inputs texte
- Logs `console.error` ciblés pour confirmer la cause exacte

## Phase 2 — Refonte visuelle "tontine sérieuse"

Direction : produit financier de confiance pour la Guinée — palette **Bleu sarcelle #0D7377 / Or #E8AA14** (déjà dans le design system), typographie display affirmée, densité d'information rassurante, micro-copies pédagogiques sans infantiliser.

Pour cette phase, je vais générer **3 directions design rendues** via le tool prévu à cet effet, puis te laisser choisir avant d'implémenter. Cibles visuelles :
- Stepper plus institutionnel (numérotation, libellés clairs, état de complétion)
- Cards de formulaire avec hiérarchie nette, helpers explicatifs (ex. "Une cotisation hebdomadaire convient aux groupes de proches")
- Récapitulatif `TermSheet` repensé comme un vrai contrat-aperçu (sections, bénéficiaires, calendrier, règles)
- États vides / erreurs / loading dignes d'un produit fintech

⚠️ Périmètre strictement visuel + ergonomie. Pas de changement de logique métier (RPC, validation Zod, schémas DB inchangés).

## Phase 3 — Test E2E sur un nouveau groupe

1. **Alice** se connecte (`alice@test.local`) → crée un **nouveau** groupe via le wizard refondé (ex. « Tontine Alpha 2026 »), génère un code d'invitation
2. **Bob** (`bob@test.local`) → `/rejoindre` → saisit le code → vérifie le statut `pending` et la visibilité du groupe (validations des migrations 09/10/11)
3. **Alice** → onglet Membres → **Approuve** Bob → vérifie transition `active` + notification
4. **Bob** → recharge → badge `INSCRIPTION` disparu, notification reçue, accès complet
5. **Cas d'erreur** : code invalide → message explicite

## Phase 4 — Rapport final
- ✅ Bug page blanche : cause + correctif
- ✅ Refonte UI : avant/après, direction retenue
- ✅ Scénario E2E : ce qui fonctionne, bugs résiduels, recommandations

## Hors scope
Paiements Orange/MTN, refonte annuaire, optimisations perf, refonte d'autres pages.

## Ordre d'exécution proposé
1. **Fix crash** (bloquant — sans ça impossible de créer un groupe)
2. **Générer 3 directions design** → tu choisis
3. **Implémenter la direction choisie**
4. **Test E2E avec toi**
