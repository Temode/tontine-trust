# Audit end‑to‑end : invitation & adhésion à un groupe

## Objectif
Tester de bout en bout, dans le navigateur d'aperçu, les deux voies d'invitation actuellement implémentées (code `TD-XXXX-XXXX` + lien `/?code=…` via la page « Rejoindre un groupe ») avec **deux comptes réels**, puis livrer un rapport d'audit listant tout ce qui ne fonctionne pas ou présente un risque pour un usage entreprise.

## Scénario de test

1. **Compte A — Organisateur**
   - Création via `/auth` (email + mot de passe + nom + téléphone)
   - Création d'un groupe de tontine via `/nouveau` (5 étapes : identité → finances → règles → invitations → revue)
   - Ouverture de `/groupes/:id`
   - Récupération du **code** et du **lien** affichés par `InvitePanel`
   - Test des actions : Copier code, Copier lien, ouvrir mailto, ouvrir wa.me, générer un nouveau code, révoquer un code
2. **Compte B — Invité**
   - Déconnexion du compte A
   - Création du compte B
   - **Voie 1 — code** : aller sur `/rejoindre`, coller le code dans `CodeEntryHero`, valider
   - **Voie 2 — lien** : copier le lien partagé par A, ouvrir dans un nouvel onglet, vérifier la pré‑remplissage et l'adhésion
3. **Retour compte A**
   - Vérifier l'apparition du membre B (statut pending vs active selon les règles du groupe)
   - Tester `approve_member` / `reject_member` depuis la liste des membres en attente
   - Vérifier le compteur « X membres actifs »
4. **Vérifications transverses**
   - RLS : B ne doit voir le groupe qu'après adhésion validée
   - Notifications : A reçoit‑il une notif à la demande d'adhésion ? B à l'approbation ?
   - Idempotence : que se passe‑t‑il si B tente de rejoindre deux fois ?
   - Code expiré / révoqué / max_uses atteint : messages d'erreur lisibles ?
   - Lien partageable : la route consommant le `?code=` existe‑t‑elle réellement ?

## Méthode

- Utilisation des outils `browser--view_preview`, `observe`, `act`, `screenshot`, `read_console_logs`, `list_network_requests` pour piloter l'aperçu.
- Lectures ciblées via `psql` (sélection seule) sur `groups`, `group_members`, `invitations`, `notifications` pour confirmer l'état serveur entre chaque étape.
- Aucun commit code pendant l'audit : uniquement observation. Les correctifs seront proposés ensuite dans un second plan séparé, classés par sévérité.

## Livrables

Un **rapport d'audit** structuré :

```text
[BLOQUANT]   description courte — preuve (capture / log / requête)
[MAJEUR]     …
[MINEUR]     …
[UX]         …
[SÉCURITÉ]   …
```

Pour chaque finding : composant/fichier concerné, étape de repro, comportement observé vs attendu, et recommandation correctrice. Sévérités évaluées selon l'usage entreprise (traçabilité, intégrité financière, expérience organisateur).

## Points d'attention déjà identifiés à vérifier prioritairement

- Le **lien partageable** généré par `InvitePanel` pointe vers `https://tontine.digital/join/<code>` (domaine non déployé) — à confirmer, et probablement à remplacer par `window.location.origin` + une route réelle.
- `CodeEntryHero` lit le code depuis l'input mais **n'auto‑remplit pas** depuis `?code=` dans l'URL (à vérifier).
- L'organisateur n'est ajouté à `group_members` que via trigger : si `db/08_backfill_organizer_membership.sql` n'a pas été exécuté pour les anciens groupes, le compteur restera à 0.
- `JoinGroup.tsx` utilise encore `directoryGroups` et `myApplications` issus de `mock-data` — à valider que ce n'est pas montré comme « production » à l'utilisateur final.
- Vérifier les politiques RLS sur `invitations` (création par organisateur uniquement, lecture par tous pour valider un code).

## Hors scope

- Tests de paiement Orange/MTN Money (autre phase).
- Tests de charge / sécurité offensive.
- Correctifs : seront proposés dans un plan dédié après validation du rapport.

## Action utilisateur requise

Passer en **mode Build** pour que je puisse piloter le navigateur (création de comptes réels en base) et exécuter les requêtes `psql` de vérification.
