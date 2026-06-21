## Objectif

Couvrir les 5 demandes en respectant la doctrine design (bleu sarcelle + or, font-display, skeletons, une seule action primaire, tabular-nums).

---

## Lot 1 — Tests automatisés des règles RLS / validation

**Cible** : RPC `create_group_with_invitation`, `preview_group_by_code`, `join_group_with_code`, vue `my_contributions_due`.

Deux niveaux :

1. **Tests unitaires Vitest** (`src/lib/validation/policy.test.ts`) sur les schémas Zod partagés : montants hors bornes, multiples interdits, fréquences hors liste, codes mal formés. Rapides, déterministes, exécutés en CI.
2. **Tests d'intégration Supabase** (`tests/e2e/rls-quick-actions.spec.ts`, exécuté par le job E2E existant `.github/workflows/e2e.yml`) :
   - Code invalide → erreur format.
   - Code inexistant → `null` / erreur traduite.
   - Code expiré (seed via fixture) → message contextuel.
   - Code épuisé (usage limit atteint) → erreur.
   - Création avec montant < 1 000 ou non multiple → rejetée par RPC.
   - Création avec fréquence inconnue → rejetée.
   - `my_contributions_due` ne retourne que les cotisations de l'utilisateur connecté (test cross-user avec service role).

Réutilise la fixture `tests/e2e/fixtures/famille-alice.ts`, ajoute un helper `seedExpiredInvitation` et `seedExhaustedInvitation`.

## Lot 2 — Copie du code d'invitation renforcée

Refonte de `InviteSuccessPanel` :
- **Mode masqué par défaut** : code affiché en `••••-••••-••••` avec bouton œil (show/hide).
- **Bouton copier** : feedback immédiat (icône check vert + toast 1.5s, libellé "Copié ✓"), retour à l'état initial après 2s.
- **Compteur de régénérations** : `Régénérations utilisées : X / 3` (limite côté client + future garde RPC). Bouton désactivé quand atteint avec tooltip.
- **Lien d'invitation** : même pattern masqué/copié.
- Tout en tokens sémantiques, font-display, tabular-nums pour le compteur.

Pas de migration SQL (la limite côté serveur sera ajoutée plus tard si besoin).

## Lot 3 — Notifications rappels (in-app + e-mail)

**In-app** : déjà supporté via table `notifications` et hook `useNotificationsRealtime`. Ajoute deux types : `turn_upcoming` (J-2 avant le prochain tour) et `contribution_due_reminder` (J-3 et J-1).

**E-mail** : utilise l'infrastructure Lovable Emails.
- Si domaine déjà configuré → `email_domain--scaffold_transactional_email` puis 2 templates : `turn-upcoming.tsx`, `contribution-due.tsx` (palette sarcelle/or).
- Sinon → demander à l'utilisateur d'activer le domaine via le dialog officiel.

**Scheduler** : Edge Function `send-tontine-reminders` invoquée par `pg_cron` chaque heure. Elle interroge `my_contributions_due` / `turns` à venir, respecte `notification_preferences` (`turn_upcoming`, `contribution_due` × canaux `in_app`/`email`), enqueue les emails et insère les notifications in-app.

**Réglages depuis GroupDetail** : nouveau bloc « Rappels » dans l'onglet Paramètres de la tontine (ou menu kebab → "Préférences de rappel") qui édite `notification_preferences` filtrées sur ces 2 types. Réutilise l'API existante `listMyNotificationPreferences` / `updateNotificationPreferences`.

## Lot 4 — Page « Mes contributions »

Nouvelle route `/mes-contributions` (la page actuelle `MyContributions.tsx` à `/payer` reste pour le flux de paiement express ; on extrait la liste vers une vue dédiée plus riche, ou on enrichit l'existante — je choisis **enrichir** pour ne pas dupliquer).

Ajouts dans `MyContributions.tsx` :
- **Hero compact** : titre display, total dû, nombre de cotisations en retard.
- **Filtres** : statut (toutes / due / en retard / payée), tontine (select), recherche texte (nom de tontine).
- **Récap par tontine** : carte par groupe avec total à régler + nombre d'échéances + CTA "Tout payer" (chaîne les paiements via la file existante).
- **Liste détaillée** : status badge (StatusBadge réutilisé), date d'échéance, montant, urgence colorée (`<3j` destructive, `<7j` accent or, sinon neutre).
- État vide doctrine (`EmptyState`).
- Skeletons (jamais de spinner).

Données : `my_contributions_due` (déjà filtrée par `auth.uid()`) + `my_payments_history` pour le statut "payée".

## Lot 5 — Historique des codes d'invitation dans GroupDetail

Nouveau panneau `InvitationsHistoryPanel` ajouté dans un onglet « Invitations » de `GroupDetail.tsx` :
- Table responsive : Code (masqué par défaut, bouton œil), Statut (badge `valide` / `expiré` / `épuisé` / `révoqué`), Créé le, Expire le, Utilisations `X / max`.
- Action : copier, révoquer (organisateur uniquement, RPC existante si dispo sinon UPDATE direct via RLS), régénérer.
- Tri par date desc, pagination si > 20.
- API : nouvelle fonction `listGroupInvitations(groupId)` dans `src/lib/api/invitations.ts` (lecture sur `invitations` filtrée par `group_id`, RLS existante restreint déjà aux membres organisateurs).

---

## Ordre d'implémentation

1. **Lot 2** (UI pure, rapide, livre une amélioration visible immédiate).
2. **Lot 5** (UI + petit ajout API, complète la page détail).
3. **Lot 4** (page Mes contributions enrichie).
4. **Lot 1** (tests Vitest + E2E — verrouille les acquis).
5. **Lot 3** (notifications — plus lourd : migration SQL + edge function + emails + UI réglages).

## Points à confirmer avant exécution

1. **Lot 3 e-mails** : tu veux que je provisionne tout de suite l'infrastructure Lovable Emails (création domaine via dialog si absent) ? Ou on commence par in-app seulement et on branche l'email après ?
2. **Lot 4** : j'enrichis la page existante `/payer` (recommandé, pas de duplication) ou je crée une route séparée `/mes-contributions` qui coexiste ?
3. **Lot 1 tests RLS** : tu valides l'extension de la fixture `famille-alice` (seeds invitation expirée + épuisée) plutôt qu'une nouvelle fixture isolée ?
