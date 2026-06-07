## Finalisation qualité Tontine Digitale — patchs post-test

Test E2E (Alice → création « Lien partageable » + Bob → adhésion + candidature) validé. Trois imperfections doivent être corrigées pour atteindre la barre « marché réel ».

---

### 1. `JoinFlow` — récap contrat complet

Aujourd'hui la section « Termes du contrat » du dialog ne montre que le code. Le candidat s'engage à l'aveugle.

- Ajouter une RPC `public.preview_group_by_code(_code text) returns jsonb` (`security definer`, `search_path = public`) renvoyant `{ name, description, contribution_amount, frequency, max_members, members_count, visibility, organizer_name }` à partir du code (lecture seule, ne touche pas aux compteurs, sans rate-limit).
- Migration `db/14_preview_group_by_code.sql`.
- `src/lib/api/invitations.ts` : `previewByCode(code)` qui appelle la RPC.
- `src/components/join-group/JoinFlow.tsx` : si `mode="code"`, fetch via React Query au montage et afficher :
  - Nom, organisateur, fréquence, cotisation (via `formatGNF`), membres, cagnotte totale (`contribution × max_members`).
- Skeleton pendant le chargement, fallback erreur traduit (`INVITATION_NOT_FOUND` → message clair).

### 2. `IssuedConfirmation` — intégrer QR + aperçu

Le bloc post-émission affiche code + lien + WhatsApp + Copier mais omet le QR et l'aperçu invité.

- Dans `src/pages/CreateGroup.tsx`, remplacer le bloc « Invitation prête à partager » par le composant `ShareSheet` existant (qui inclut déjà `QrCodeSvg`).
- Ajouter sous le `ShareSheet` un encart compact « Ce que verra l'invité » réutilisant `GroupProspectus` en mode `compact` (props : nom, organisateur, cotisation, fréquence, membres) — sans bouton « Rejoindre » (mode lecture seule).

### 3. `MyGroups` — KPI strip basé sur les vraies données

Le strip affiche encore les valeurs mock (`7 groupes`, `51 450 000 GNF`…) alors que la section dessous est en données réelles.

- Dans `src/pages/MyGroups.tsx`, dériver les KPIs depuis `listMyGroups()` :
  - `PORTEFEUILLE` = `rows.length`, ventilé `actifs / votre tour / en cours / clos` via `status` + `is_my_turn`.
  - `CAPITAL ENGAGÉ RESTANT` = somme `(max_members - completed_turns) × contribution_amount` sur les groupes actifs.
  - `CAGNOTTES EN CIRCULATION` = somme `max_members × contribution_amount` sur les groupes actifs ; `Prochaine cagnotte` = min `next_payout_at`.
  - `SCORE MOYEN` = laisser pour l'instant en `—` si `profile.reliability` indisponible, sinon utiliser la valeur réelle.
- Supprimer l'import de mock-data dans `MyGroups.tsx`.

---

### Fichiers

- Nouveaux : `db/14_preview_group_by_code.sql`.
- Édités : `src/lib/api/invitations.ts`, `src/components/join-group/JoinFlow.tsx`, `src/pages/CreateGroup.tsx`, `src/components/join-group/GroupProspectus.tsx` (mode `compact`), `src/pages/MyGroups.tsx`.

### Validation après build

1. Créer un groupe « Lien partageable » → vérifier QR + aperçu invité visibles dans la confirmation.
2. Coller le lien dans un onglet privé connecté en tant que Bob → JoinFlow affiche nom + cotisation + organisateur.
3. Revenir sur `/mes-groupes` → KPIs cohérents avec la liste affichée.

### Hors périmètre

Mock-data résiduelles ailleurs (Dashboard, MyContributions), intégration réelle Mobile Money, paramétrage SLA. À traiter dans un lot dédié.
