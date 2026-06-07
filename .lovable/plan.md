
## Audit du parcours adhésion (création → invitation → join)

Périmètre audité : `CreateGroup` (wizard 5 étapes), `InviteMembers`, `JoinGroup` (`CodeEntryHero`), API `groups.ts` / `invitations.ts`, dialog d'annuaire `SubscriptionDialog`, liste `ApplicationsList`.

---

### Constats — ce qui ne tient pas la promesse « Tontine Digital »

**A. Données du wizard partiellement perdues à la création**
- `StepInvitations` collecte `visibility` (privé / lien / annuaire) et `coOrganizerPhones` mais `createGroup()` ne les envoie pas — les choix de l'organisateur sont silencieusement ignorés.
- `latePenaltyPercent`, `latePenaltyAfterDays`, `swapPolicy`, `rotationOrder=auction` sont aplatis (auction → choice) sans avertir l'utilisateur.
- Aucune validation Zod côté client avant `insert` : un nom de 2 caractères, une cotisation à 0, ou des membres à 1 partent en base.

**B. Écran de confirmation fragile et incohérent**
- `IssuedConfirmation` utilise `new Intl.NumberFormat("fr-FR").format(...)` au lieu du helper `formatGNF` durci → reproduit le risque de page blanche corrigé ailleurs.
- Affiche « cagnotte … par tour » mais la création n'a pas persisté la fréquence localisée FR (jour/semaine/quinzaine/mois) — la valeur visible peut différer du contrat émis.
- CTA secondaire « Voir le groupe » sans état (membre seul / en attente de quorum) — l'organisateur arrive sur une page vide.

**C. Création + 1ère invitation non transactionnelles**
- `createGroup` puis `createInvitation` sont deux appels séparés. Si la 2ᵉ échoue, le groupe existe sans code, sans message clair. Le fallback `catch { createInvitation({ groupId }) }` masque toute erreur (pas seulement collision de code).
- L'organisateur n'est pas garanti ajouté en `group_members` côté client — on dépend d'un trigger DB invisible : à vérifier et documenter.

**D. Promesses marketing non tenues (risque de confiance)**
Les textes annoncent « OTP », « biométrie », « signature cryptographique », « notarisation », « 72h », « registre immuable ». Aucun de ces mécanismes n'est implémenté dans le flux audité. Pour un produit financier en Guinée, cette sur-promesse est un risque réputationnel.

**E. Parcours « rejoindre par code » incohérent avec « rejoindre depuis l'annuaire »**
- `CodeEntryHero` accepte le code et exécute `joinWithCodeAndStatus` **sans aucune étape de consentement**, sans récap des termes, sans choix opérateur Mobile Money, sans message à l'organisateur.
- À l'inverse, `SubscriptionDialog` (annuaire) impose contrat, KYC, opérateur, consentement. Deux portes d'entrée, deux niveaux d'engagement → injuste pour le membre et risqué pour l'organisateur.
- Pire : `?code=` dans l'URL déclenche un **auto-join silencieux**. Cliquer un lien WhatsApp = adhésion immédiate sans lire les termes.

**F. UX de l'invitation pauvre pour un marché réel**
- `InviteMembers` n'a aucun partage natif (WhatsApp, SMS, copie de lien complet, QR code). En Guinée le canal de partage est WhatsApp à 90 % — il faut un bouton dédié avec message pré-rédigé.
- Aucune date d'expiration ni `max_uses` éditables alors que l'API les supporte.
- Le statut affiché brut (`pending`, `revoked`, `accepted`, `expired`) n'est pas traduit en français.
- Pas d'aperçu « ce que verra l'invité » avant partage.

**G. Suivi côté membre invisible**
- Après un join `pending`, `CodeEntryHero` redirige vers `/groupes` mais il n'existe aucune section « Mes candidatures en attente » dans la liste (le composant `ApplicationsList` existe mais n'est pas câblé sur des vraies données).
- Le membre ne sait pas où retrouver sa demande, ni comment l'annuler.

**H. Accessibilité & UX détaillée**
- L'input de code (`CodeEntryHero`) bloque à 12 caractères mais n'annonce pas la progression aux lecteurs d'écran (pas d'`aria-live` sur le `StateLine`).
- Le bouton « Régénérer le code » dans `StepInvitations` ne demande pas confirmation alors qu'il invaliderait les codes déjà partagés (texte le promet, code ne l'applique pas — le code reste local jusqu'à l'émission).
- `coOrganizerPhones` accepte n'importe quoi — pas de validation format MSISDN guinéen `+224 6XX XXX XXX`.

**I. Sécurité / RLS à confirmer**
- Vérifier que `invitations.insert` exige `created_by = auth.uid()` ET que l'utilisateur est organisateur du groupe (sinon n'importe quel membre peut générer des codes).
- Vérifier que `join_group_with_code` ajoute toujours le candidat en `status='pending'` quand `visibility` ≠ `private`-invité, et déclenche la notification organisateur.
- Vérifier que `revokeInvitation` est limité à l'organisateur (UPDATE policy).

---

### Plan de correction

**Phase 1 — Intégrité des données (bloquant)**
1. Étendre `createGroup` API + payload pour persister `visibility`, `co_organizers`, `swap_policy`, `late_penalty_*` ; créer migration si colonnes manquantes (ajouter `co_organizers text[]` et `visibility` enum).
2. Ajouter validation Zod centralisée (`createGroupSchema`) avec messages FR ; bloquer le bouton « Émettre » si invalide et afficher la liste d'erreurs avec lien vers l'étape concernée.
3. Encapsuler `createGroup + createInvitation + ensure_organizer_membership` dans une **RPC `create_group_with_invitation`** (transaction unique) ; supprimer le fallback silencieux.

**Phase 2 — Émission propre**
4. Refactor `IssuedConfirmation` : utiliser `formatGNF`, garder le récap aligné sur `derived`, ajouter QR code + 3 boutons partage (WhatsApp pré-rédigé, copier lien, copier code), prévisualisation « vue invité ».
5. Confirmation de régénération de code dans `StepInvitations` + libellé honnête (« le code sera remplacé à l'émission »).

**Phase 3 — Parcours invitation pro**
6. `InviteMembers` : ajouter contrôles `max_uses` et `expires_at`, traduire les statuts, bouton « Partager via WhatsApp », QR code par invitation, modal « Aperçu invité ».
7. Validation MSISDN guinéen sur `coOrganizerPhones` avec chips visuels.

**Phase 4 — Parcours « Rejoindre » unifié et sûr**
8. Désactiver l'auto-join sur `?code=` : pré-remplir, puis ouvrir un **écran de souscription** identique à `SubscriptionDialog` (récap contrat, opérateur Mobile Money, message, consentement explicite).
9. Mutualiser le composant de souscription entre annuaire et code → un seul parcours d'engagement.
10. Câbler `ApplicationsList` sur les vraies candidatures `pending/declined/accepted` du membre ; afficher la section sous `CodeEntryHero` et dans `MyGroups`.

**Phase 5 — Discours produit aligné**
11. Retirer ou justifier chaque mention « OTP / biométrie / cryptographique / notarisé / registre immuable » : soit on les implémente, soit on les remplace par des formulations vérifiables (« horodaté », « trace d'audit », « validation par l'organisateur »).
12. Délais annoncés (« réponse sous 72h ») → rendre paramétrable par l'organisateur ou retirer.

**Phase 6 — Accessibilité & micro-UX**
13. `aria-live="polite"` sur `StateLine`, labels explicites, focus management après chaque étape, gestion clavier dans `Stepper`.
14. Empty states dignes (pas de groupe / pas de code / pas de candidature) avec CTA contextuel.

**Phase 7 — Sécurité (à confirmer puis durcir si besoin)**
15. Audit RLS sur `invitations` (INSERT/UPDATE réservés organisateur), `group_members` (INSERT via RPC uniquement), `groups` (UPDATE limité organisateur).
16. Rate-limit `join_group_with_code` (déjà côté DB ? sinon edge function) pour empêcher l'énumération de codes.

---

### Détails techniques

- Fichiers principaux à modifier : `src/pages/CreateGroup.tsx`, `src/pages/InviteMembers.tsx`, `src/pages/JoinGroup.tsx`, `src/components/join-group/CodeEntryHero.tsx`, `src/components/join-group/SubscriptionDialog.tsx`, `src/components/create-group/StepInvitations.tsx`, `src/components/create-group/StepReview.tsx`, `src/lib/api/groups.ts`, `src/lib/api/invitations.ts`.
- Nouvelles : `src/lib/validation/group.ts` (Zod), `src/components/join-group/JoinFlow.tsx` (parcours unifié), `src/components/invite/ShareSheet.tsx` (WhatsApp/QR), migration RPC `create_group_with_invitation`.
- Hors périmètre : intégration réelle Orange/MTN Money, KYC, signature cryptographique (laissés en backlog explicite).

### Diagramme du parcours cible

```text
Organisateur                               Invité
────────────                               ──────
Wizard 5 étapes  ──► RPC create_group_with_invitation
       │                       │
       │                       ├──► group + invitation + organizer membership
       ▼                       │
Confirmation + ShareSheet ◄────┘
(QR, WhatsApp, lien, code)
       │
       └──► partage ───────────────►  /join?code=TD-XXXX-XXXX
                                              │
                                              ▼
                                     Pré-remplit le code
                                              │
                                              ▼
                                     Écran de souscription
                                     (récap, opérateur, consentement)
                                              │
                                              ▼
                                     RPC join_group_with_code → pending
                                              │
                                              ▼
                                     ApplicationsList (Mes candidatures)
                                              │
                          Organisateur valide ▼
                                     Notification + accès actif
```

### Ordre d'exécution proposé
Phase 1 → 2 → 4 → 3 → 5 → 6 → 7. Les phases 1, 2, 4 sont prioritaires (intégrité + sécurité de l'adhésion). Les phases 3, 5, 6 finalisent l'image « marché réel ». La 7 nécessite vérifications RLS.
