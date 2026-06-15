# Plan — Test E2E Phases A→D + correctif accès "Gérer les membres"

## Constat préalable (à corriger en même temps)

`MembersAdminPanel` (suspend / kick / permissions / promote co-org / transfer) n'est aujourd'hui accessible que via **Paramètres du groupe** (`/groupes/:id/parametres`). Cette page est gardée par `isOrganizer = group.created_by === user.id` ce qui exclut les co-organisateurs et n'offre aucun raccourci visible depuis le détail du groupe ni l'onglet "Membres". D'où le ressenti "je ne vois pas comment gérer les comptes".

### Correctif UI (minimal, frontend)

1. **`src/pages/GroupDetail.tsx`** — dans l'onglet *Membres* (`MembersTab`), si `isOrganizer` ou si l'utilisateur courant possède au moins une permission admin (`listAdminPermissions` retourne une ligne pour lui), afficher un bouton primaire **"Gérer les membres"** qui ouvre `/groupes/:id/membres`.
2. **Nouvelle page `src/pages/GroupMembers.tsx`** montée sur `/groupes/:id/membres` :
   - Garde d'accès : `isOwner || hasAnyAdminPermission` (sinon redirect + toast comme la page Co-organisateurs).
   - Réutilise `MembersAdminPanel` (déjà complet) + un sous-onglet "Co-organisateurs" qui pointe vers `/groupes/:id/co-organisateurs`.
3. **`src/App.tsx`** — route lazy `/groupes/:id/membres`.
4. **`src/components/group/MembersAdminPanel.tsx`** — passer `isOwner` calculé par le parent (`currentUserId === ownerUserId`) tel quel ; étendre les boutons d'action pour qu'un co-organisateur avec `can_suspend_member` / `can_kick_member` voie aussi les options (la RPC fait déjà l'autorisation, on n'a qu'à débrider l'UI).

Aucun changement SQL.

## Test end-to-end (Playwright via shell, headless Chromium)

Scénario complet exécuté contre `http://localhost:8080` avec deux sessions parallèles (Alice / Bob).

### Setup
- Fichier `/tmp/browser/e2e_admin/script.py`.
- Deux `BrowserContext` distincts (un par compte) pour login Alice + Bob simultanément.
- Capture screenshots à chaque étape clé sous `screenshots/`.

### Étapes
1. **Auth** — Alice et Bob se connectent via `/auth` (form email/password). Vérif redirect `/dashboard`.
2. **Création groupe (Alice)** — `/nouveau` → wizard 5 étapes → nom "Tontine E2E", cotisation 10000, 5 membres, fréquence hebdomadaire, rotation aléatoire, visibilité "lien partageable". Capture du code d'invitation à la fin.
3. **Join (Bob)** — `/rejoindre` → entre le code → checkbox CGU (Phase D) → confirme. Vérif statut "En attente".
4. **Approbation (Alice)** — `/groupes/:id` onglet Membres → "Accepter" la candidature de Bob.
5. **Accès "Gérer les membres"** — Alice clique le bouton "Gérer les membres" (correctif) → vérifie présence du panneau, badge statut, menu actions.
6. **Phase B1 — Suspension** — Alice suspend Bob avec motif "test e2e". Vérifs :
   - Badge "Suspendu" + motif visible.
   - Notification créée pour Bob (`/notifications`).
   - Côté Bob, tentative de poster dans le chat → bloquée.
7. **Réactivation** — Alice réactive Bob. Vérif badge "Actif" rétabli.
8. **Phase B3 — Co-organisateur** — Alice ouvre `/groupes/:id/co-organisateurs` → promeut Bob avec `can_suspend_member` + `can_send_announcements`. Vérif card Bob dans la liste avec matrice verte sur les 2 permissions.
9. **Phase B4 — Permissions membre** — Alice ouvre dialog "Permissions membre" sur Bob, désactive `can_chat`. Vérif côté Bob : envoi chat refusé.
10. **Phase C2 — Pénalité** — (skip si pas de contribution générée). Si une cotisation existe, Alice tente `waive_penalty` via UI panneau.
11. **Phase C3 — Pause cycle** — Alice met le cycle en pause (`CycleAdminPanel`). Vérif badge "En pause" sur la carte groupe.
12. **Phase C7 — Historique paiements** — Alice ouvre `PaymentsHistoryPanel`, vérifie le rendu + bouton "Exporter CSV".
13. **Phase B5 — Transfer ownership** — Alice transfère la propriété à Bob (confirmation 2 étapes). Vérif : Bob devient propriétaire (badge Crown), Alice reste co-org avec tous les droits.
14. **Phase D4 — Privacy** — Bob ouvre `/profil/confidentialite`, toggle "Afficher mon téléphone". Vérif persistance.
15. **Phase D1 — Suppression compte** — *(facultatif, destructif — on commente cette étape)* : naviguer vers `/profil/suppression`, vérifier l'écran de confirmation 2 étapes mais NE PAS valider (sinon le compte de test est perdu).

### Vérifications transverses
- Aucun error toast inattendu (capture console errors via `page.on("console")`).
- Aucun appel réseau 4xx/5xx imprévu (capture `page.on("response")`, filtrer `.supabase.co/rest|rpc`).
- Screenshots finaux comparés visuellement (badges, dialogs, matrices).

## Livrables du test

- `/tmp/browser/e2e_admin/script.py` — script Playwright complet.
- `/tmp/browser/e2e_admin/screenshots/*.png` — preuves visuelles par étape.
- Rapport d'audit synthétique en réponse finale :
  - ✅ ce qui marche
  - ⚠️ régressions / friction UX détectées (notamment le manque de raccourci "Gérer les membres" — corrigé)
  - ❌ bugs bloquants éventuels avec stack/erreur réseau.

## Fichiers touchés (correctif)

```text
+ src/pages/GroupMembers.tsx
~ src/App.tsx               (route /groupes/:id/membres)
~ src/pages/GroupDetail.tsx (bouton "Gérer les membres" dans onglet Membres)
~ src/components/group/MembersAdminPanel.tsx (autorise co-org avec perms à voir les actions)
```

Test exécuté après le correctif pour valider de bout en bout.
