## Finalisation du parcours adhésion — qualité Tontine Digitale

Objectif : compléter les phases restantes de l'audit dans l'ordre 1.3 → 2 → 4.2 → 3 → 5 → 6 → 7, sans régresser l'existant.

---

### Phase 1.3 — Création transactionnelle

- Nouvelle migration `db/13_create_group_with_invitation.sql` :
  - Fonction `public.create_group_with_invitation(payload jsonb)` `security definer`, `search_path = public`.
  - Insère `groups` (avec `visibility`, `co_organizers`, `swap_policy`, `late_penalty_*`), insère `group_members` (organisateur `active`), insère `invitations` (code unique TD-XXXX-XXXX, retries sur collision), retourne `{ group_id, invite_code }`.
  - Échec → rollback global.
- `src/lib/api/groups.ts` : nouvelle fonction `createGroupWithInvitation(draft)`, appelle la RPC, supprime le fallback silencieux.
- `src/lib/validation/group.ts` : `createGroupSchema` Zod complet (nom 3-60, description ≤280, contribution > 0, members 3-50, MSISDN, fréquence, rotation). Helper `formatGroupErrors` retournant `{ stepIndex, message }[]`.
- `src/pages/CreateGroup.tsx` : `handleIssue` parse via Zod, si erreurs → toast + saut sur la première étape concernée, sinon RPC unique.

### Phase 2 — Émission propre

- `IssuedConfirmation` (dans `CreateGroup.tsx`) :
  - Remplacer `Intl.NumberFormat` par `formatGNF`.
  - Intégrer `ShareSheet` (QR + WhatsApp + lien + code) à la place du bloc « Lien d'invitation » actuel.
  - Ajouter aperçu compact « ce que verra l'invité » (extrait `GroupProspectus`).
  - CTA secondaire « Voir le groupe » → route `/groupes/:id`.

### Phase 4.2 — JoinFlow unifié

- Nouveau `src/components/join-group/JoinFlow.tsx` : composant dialog/route unique
  - Étapes : Récap contrat → Choix opérateur Mobile Money (Orange / MTN) → Message à l'organisateur (optionnel, ≤280) → Consentement explicite (case à cocher + bouton « Confirmer mon adhésion »).
  - Props : `mode: "code" | "directory"`, `groupSummary`, `onConfirm()`.
- Refactor `ConfirmJoinDialog` → délègue à `JoinFlow` (`mode="code"`).
- Refactor `SubscriptionDialog` → délègue à `JoinFlow` (`mode="directory"`).
- Persistance opérateur + message : colonnes `preferred_operator text`, `applicant_message text` sur `group_members` (migration `db/14_join_metadata.sql`, défaut null, RLS inchangée).

### Phase 3 — Invitations qualité marché

- `src/pages/InviteMembers.tsx` + `InvitationsTable` :
  - Contrôles `max_uses` (number) et `expires_at` (date) dans `ComposeDialog`.
  - Statuts traduits FR (`pending` → En attente, etc.) via helper `formatInvitationStatus`.
  - Bouton « Partager WhatsApp » par ligne + bouton « QR » ouvrant un Sheet avec `QrCodeSvg`.
  - Modal « Aperçu invité » réutilisant `GroupProspectus`.

### Phase 5 — Discours produit aligné

- Recherche puis remplacement des mentions non implémentées dans `CreateGroup`, `JoinGroup`, `InviteMembers`, `GroupProspectus`, `ConfirmJoinDialog` :
  - « OTP / biométrie / signature cryptographique / notarisé / registre immuable » → « horodaté », « trace d'audit », « validation par l'organisateur ».
  - « réponse sous 72 h » → « selon l'organisateur » (paramétrage reporté en backlog).

### Phase 6 — Accessibilité & micro-UX

- `Stepper` : gestion clavier (←/→), `aria-current="step"`, focus auto sur titre d'étape au changement.
- Empty states : `MyGroups` (aucun groupe, aucune candidature), `InviteMembers` (aucun code), avec CTA contextuel.
- `min-h-11 min-w-11` sur boutons icône critiques du parcours.

### Phase 7 — Sécurité RLS

- Migration `db/15_rls_hardening.sql` :
  - `invitations` INSERT/UPDATE → `auth.uid() = created_by AND public.is_group_organizer(group_id, auth.uid())`.
  - `groups` UPDATE → organisateur uniquement.
  - `group_members` INSERT → uniquement via RPC `join_group_with_code` ou `create_group_with_invitation` (revoke direct INSERT pour `authenticated`).
- Rate-limit `join_group_with_code` : table `join_attempts(user_id, attempted_at)`, fonction lève `RATE_LIMITED` si > 10 tentatives / 10 min.

---

### Détails techniques

- Nouveaux fichiers : `db/13_create_group_with_invitation.sql`, `db/14_join_metadata.sql`, `db/15_rls_hardening.sql`, `src/components/join-group/JoinFlow.tsx`, helpers `formatInvitationStatus`, `formatGroupErrors`.
- Fichiers édités : `CreateGroup.tsx`, `InviteMembers.tsx`, `JoinGroup.tsx`, `CodeEntryHero.tsx`, `ConfirmJoinDialog.tsx`, `SubscriptionDialog.tsx`, `StepInvitations.tsx`, `Stepper.tsx`, `MyGroups.tsx`, `groups.ts`, `invitations.ts`, `validation/group.ts`, `GroupProspectus.tsx`, `InvitationsTable.tsx`, `ComposeDialog.tsx`.
- Hors périmètre (laissé en backlog) : intégration réelle Orange/MTN Money, KYC, signature cryptographique réelle, paramétrage SLA par organisateur.

### Validation

Après chaque phase, vérifier en preview : création complète sans erreur, partage WhatsApp/QR, parcours code = parcours annuaire, candidature visible dans « Mes candidatures », annulation OK, RLS testée (membre non-organisateur ne peut pas créer d'invitation).
