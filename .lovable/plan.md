## Plan : Amélioration de la création de groupe + mode test Djomy

### 1. StepFinancials — UX du montant minimum
**Fichier** : `src/components/create-group/StepFinancials.tsx`
- Afficher un libellé permanent sous l'input : « Minimum 1 000 GNF · Exemples : 1 000, 5 000, 100 000 »
- Ajouter un état d'erreur inline (rouge) quand `0 < contribution < 1000` :
  - Bordure `border-destructive`, message : « La cotisation doit être d'au moins 1 000 GNF (saisie : X GNF). Augmentez le montant ou utilisez un raccourci ci-dessous. »
- Conserver `canContinue` basé sur `>= 1_000`, mais le message d'erreur devient visible dès la saisie.

### 2. Aperçu du calendrier dans la création de groupe
**Fichiers** : `src/components/create-group/types.ts` (helper), `src/components/create-group/StepFinancials.tsx` (ou nouvelle section dans `TermSheet.tsx`)
- Nouveau helper `computeSchedulePreview(draft)` qui retourne :
  - `startDate` : aujourd'hui (date de référence par défaut, le cycle démarre quand l'organisateur l'active)
  - `nextDueDates` : 3 prochaines échéances calculées selon `FREQUENCY_DAYS[frequency]` (1 / 7 / 14 / 30 jours)
  - `cycleEndDate` : startDate + members × frequencyDays
- Affichage dans **StepFinancials** sous la carte « Calculé à partir de vos paramètres » :
  - Bloc « Calendrier prévisionnel » avec :
    - Date de départ estimée
    - Liste des 3 prochaines échéances (formatées FR : « lun. 23 juin 2026 »)
    - Date de fin du cycle complet
  - Note discrète : « Dates indicatives ; le cycle démarre à l'activation par l'organisateur. »

### 3. Validation serveur des fréquences
**Migration SQL** sur `public.groups` (création) et la RPC `update_group_settings` (mise à jour) :
- Ajouter un trigger `BEFORE INSERT OR UPDATE` `validate_group_frequency()` qui vérifie :
  - `frequency IN ('quotidienne','hebdomadaire','quinzaine','mensuelle')` (déjà garanti par l'enum, mais on durcit)
  - `contribution_amount >= 1000`
  - `member_count BETWEEN 2 AND 50`
  - Si `frequency = 'quotidienne'` : forcer `late_penalty_after_days <= 1` (sinon la pénalité de retard ne déclenche jamais — incohérence)
- Mettre à jour la fonction `public.update_group_settings(...)` pour invoquer la même logique (ou s'appuyer sur le trigger).
- Messages d'erreur explicites en français renvoyés via `RAISE EXCEPTION` (PostgREST les remonte au front).

### 4. Mode test Djomy
**Objectif** : permettre à un organisateur de simuler un cycle complet sans attendre les échéances réelles.

**Backend** :
- Nouvelle Edge Function `djomy-test-simulate` (admin/organizer only) qui :
  - Prend `group_id` en entrée
  - Avance le cycle : crée un tour fictif, génère une `payment_link` Djomy en montant 1 000 GNF, retourne l'URL
  - Optionnellement, après paiement réel, force le passage au tour suivant
- Réutilise les helpers existants de `_shared/djomy.ts`

**Frontend** :
- Nouveau composant `src/components/group/TestModePanel.tsx` visible uniquement aux organisateurs/admins, dans `GroupDetail.tsx` sous un onglet « Mode test »
- Boutons :
  - « Générer un paiement test 1 000 GNF » → ouvre le `DjomyPaymentModal` existant
  - « Vérifier le statut » → appelle `djomy-payment-status` et affiche le résultat (succeeded / pending / failed)
  - « Avancer le cycle » → déclenche la rotation manuellement
- Badge visuel « MODE TEST » jaune sur le panneau pour éviter toute confusion en production.

### Détails techniques
- Fréquence quotidienne déjà supportée côté code + migration enum (faite précédemment).
- Le mode test ne crée pas de tontine factice — il opère sur un groupe existant et marque les `payments` avec `metadata.test = true` pour exclusion des stats globales.
- Aucun changement aux secrets Djomy : le mode production reste actif, on utilise simplement de petits montants (1 000 GNF).

### Fichiers touchés (résumé)
- `src/components/create-group/StepFinancials.tsx` (UX min + calendrier)
- `src/components/create-group/types.ts` (helper schedule)
- 1 nouvelle migration SQL (trigger validation + update RPC)
- `supabase/functions/djomy-test-simulate/index.ts` (nouvelle Edge Function)
- `src/components/group/TestModePanel.tsx` (nouveau)
- `src/pages/GroupDetail.tsx` (intégration de l'onglet)
- `src/lib/api/djomy.ts` (wrapper appel test-simulate)
