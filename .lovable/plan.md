# Audit E2E complet de la tontine

## Objectif
Jouer le parcours complet bout-en-bout dans le navigateur (Playwright headless sur `localhost:8080`), recenser tous les bugs fonctionnels et frictions UX rencontrés, puis livrer un patch correctif unique.

## Phase 1 — Préparation des comptes de test
Créer 3 comptes via l'écran `/auth` (signup email + mot de passe, sans confirmation email puisque déjà désactivée) :
- **Alice** (organisatrice) — alice.test+<timestamp>@tontine.test
- **Bob** (membre) — bob.test+<timestamp>@tontine.test
- **Carole** (membre) — carole.test+<timestamp>@tontine.test

Sessions sauvegardées en JSON dans `/tmp/browser/audit/` pour pouvoir basculer rapidement d'un utilisateur à l'autre.

## Phase 2 — Scénario fonctionnel joué dans le navigateur
1. **Alice** : compléter profil (nom, téléphone GN) → créer un groupe "Audit Tontine" (3 membres, 50 000 GNF, hebdomadaire) → récupérer le code d'invitation.
2. **Bob** puis **Carole** : `/join` → saisir code → soumettre candidature.
3. **Alice** : panneau "Candidatures en attente" → Accepter Bob et Carole.
4. **Alice** : "Démarrer le cycle" → vérifier que turns sont générés et que l'erreur précédente ne se reproduit pas (sinon capturer le toast détaillé).
5. **Bob** : `/mes-cotisations` → payer via **Djomy sandbox** (méthode OM ou MOMO, numéro sandbox) → suivre la redirection → revenir sur `/payment/return` → vérifier que la contribution passe en `succeeded`.
6. **Carole** : même paiement.
7. Vérifier le versement (payout) au bénéficiaire du tour 1, l'historique, les reçus, les notifications.
8. **Admin** (super_admin déjà configuré) : `/admin` → vérifier overview, users, groups, payments, audit.

À chaque étape : screenshot + capture console + capture network (statuts RPC/edge functions).

## Phase 3 — Recensement des problèmes
Pour chaque écran traversé, lister :
- **Bugs fonctionnels** : RPC en erreur, données manquantes, écrans cassés, redirections fausses, droits mal appliqués.
- **UX** : libellés ambigus, boutons sans feedback, états de chargement manquants, parcours qui force l'utilisateur à deviner l'étape suivante, contraste/lisibilité, messages d'erreur incompréhensibles, mobile (826×528).
- **Intégration Djomy sandbox** : init payment, redirection, webhook, retour, statut final, gestion des échecs et annulations.

Le résultat de cette phase est un rapport synthétique (max 20 items priorisés P0/P1/P2) qui sera affiché à l'utilisateur avant les correctifs.

## Phase 4 — Correctifs
Implémenter en priorité P0 puis P1 :
- Patchs SQL groupés dans **une seule migration** (RPC, vues, policies, grants).
- Patchs front ciblés (toasts détaillés, états vides, loaders, libellés, accessibilité).
- Edge functions Djomy si init/webhook/return présentent des défauts.

Aucun refactor large : on touche uniquement ce que l'audit a démontré comme défaillant.

## Phase 5 — Validation
Rejouer le scénario complet (Phase 2) une seconde fois après les correctifs. Livrer :
- Screenshots avant/après pour les problèmes UX visibles.
- Confirmation que chaque P0/P1 du rapport est résolu.
- Liste résiduelle des P2 non traités avec justification.

## Détails techniques
- Outil : Playwright Python headless, viewport 1280×1800 pour desktop + un passage 390×844 pour mobile sur les écrans clés (Dashboard, GroupDetail, MesCotisations).
- Sandbox Djomy : credentials `DJOMY_CLIENT_ID` / `DJOMY_CLIENT_SECRET` déjà configurés (à confirmer via `fetch_secrets`). Numéros de test sandbox Djomy : OM `224620000001`, MOMO `224660000001` (à valider lors de l'init).
- Webhook : vérifier que l'URL configurée côté Djomy pointe bien vers `https://<project>.functions.supabase.co/djomy-webhook`. Si non, signaler à l'utilisateur (action manuelle requise côté dashboard Djomy).
- Aucune donnée de prod n'est touchée : tous les comptes créés sont préfixés `*.test+<ts>@tontine.test`.

## Points nécessitant confirmation avant exécution
1. **Webhook Djomy** : je n'ai pas accès au dashboard Djomy. Si le webhook n'est pas configuré côté Djomy vers notre edge function, le statut de paiement restera `pending` côté DB même si le paiement réussit côté téléphone. Acceptes-tu que dans ce cas je valide la partie « initiation + redirection » et que je documente l'action manuelle à faire côté Djomy ?
2. **Confirmation email** : les comptes de test doivent pouvoir se connecter sans email confirmé. Si ce n'est pas déjà le cas, je devrai t'avertir avant de continuer.
3. **Suppression post-audit** : je laisse les comptes/groupes de test en base (préfixés `*.test`) pour que tu puisses inspecter, ou tu préfères que je les supprime à la fin ?

Réponds OK (et précise les 3 points ci-dessus si tu as une préférence) et je lance l'audit.
