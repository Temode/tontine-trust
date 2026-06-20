
# Plan en 4 chantiers — exécutés dans cet ordre

## Chantier 1 — Audit UX + refonte du menu (livré ensemble)

**Livrable 1a : rapport `docs/UX_AUDIT.md`**
- Inventaire des 30+ pages/routes actuelles classées par fréquence d'usage (Organisateur vs Membre vs Admin plateforme).
- Cartographie des frictions : navigation à 3 niveaux concurrents (sidebar desktop + bottom nav mobile + onglets internes GroupDetail), 7 panneaux empilés dans `GroupDetail`, doublons (`/cotisations` vs `/recus` vs `/paiements`), libellés ambigus.
- Score d'effort par parcours clé : "Payer ma cotisation", "Voir qui doit payer", "Supprimer un groupe", "Configurer la tontine", "Inviter un membre" (nombre de clics actuels → cible).
- Top 10 problèmes priorisés (P0/P1/P2).

**Livrable 1b : refonte immédiate de l'IA (architecture d'information)**

Sidebar réorganisée en 3 zones claires (au lieu de 2 sections plates) :

```text
ESSENTIEL                          ← ce que l'utilisateur ouvre 10x/jour
  Accueil          (= ex Tableau de bord, simplifié)
  Mes tontines     (= ex Mes groupes, badge "action requise")
  Payer            (= ex Mes cotisations, montre direct ce qui est dû)

ACTIVITÉ
  Historique       (fusion Reçus + Paiements + Cotisations payées)
  Notifications

COMPTE
  Mon profil
  Paramètres       (notifications, confidentialité, suppression compte)

[bouton flottant]  + Nouvelle tontine
```

`GroupDetail` passe de 7 panneaux empilés à **5 onglets** dans cet ordre fixe :
`Vue` · `Membres` · `Cotisations` · `Discussion` · `Administration` (organisateur uniquement, regroupe Réglages, Cycles, Permissions, Suppression, Audit).

Renommages user-facing :
- "Groupes" → "Tontines" partout.
- "Cotisations" (page racine) → "Payer".
- "Reçus" disparaît comme entrée racine, devient un onglet dans "Historique".
- "Intégrité tontine" (admin plateforme) reste au back-office.

## Chantier 2 — Suppression "cycle vide" en 1 clic

**Règle métier ajoutée** dans `request_group_deletion` :
- Si `payments` total reçu = 0 ET `contributions.status` jamais passé à `paid` → workflow **fast-track** : la demande passe directement en `pending_admin` (saute la phase `pending_members` et le délai de 48 h).
- Sinon : workflow actuel inchangé (vote membres puis admin).

**UX organisateur** (`DeletionPanel`) :
- Détecte automatiquement le cas "cycle vide" et affiche un bouton unique **"Demander la suppression à Tontine Digital"** avec un texte d'explication ("Aucune cotisation reçue — votre demande sera traitée directement par l'équipe").
- Sinon affiche le flux actuel avec vote des membres.

**Côté admin plateforme** : la file `/admin/suppressions` reçoit ces demandes en temps réel via le canal Realtime déjà actif sur `group_deletion_requests`.

**Action immédiate avec les comptes test** (après mise en prod du chantier 2) :
1. Je me connecte avec `alice@yopmail.com` via Playwright headless.
2. Pour chaque tontine existante d'Alice : déclencher la demande fast-track.
3. Tu valides depuis ton compte super-admin dans `/admin/suppressions`.

## Chantier 3 — Test Djomy réel 1000 GNF sur Orange Money

**Pré-requis à vérifier avant de lancer** (je le fais en début de chantier) :
- Confirmer que les secrets `DJOMY_CLIENT_ID` / `DJOMY_CLIENT_SECRET` actuels sont bien **production** (pas sandbox) et que `DJOMY_ENV=prod` est positionné. Si ce n'est pas le cas → je te demande les credentials prod via le tool de secrets avant d'aller plus loin.
- Vérifier que le webhook Djomy pointe sur `djomy-webhook` en prod.

**Scénario E2E exécuté ensuite via Playwright** :
1. Login `alice@yopmail.com` → crée une nouvelle tontine "Test Djomy 1000" : cotisation 1 000 GNF, fréquence hebdo, 2 places.
2. Invite `bob@yopmail.com`, Bob accepte.
3. Alice démarre le cycle → Bob est désigné payeur du Tour 1.
4. Login Bob → ouvre "Payer" → modal Djomy → méthode **OM**, numéro **611 59 93 95**.
5. Tu reçois la notification USSD/app Orange Money → tu valides le débit de 1 000 GNF.
6. Je surveille `djomy-webhook` + table `payments` jusqu'au passage `status = succeeded`.
7. Capture d'écran du reçu généré + extraction du `transaction_id` Djomy.

**Rapport de test livré** : `docs/DJOMY_LIVE_TEST.md` avec timeline complète (latences, statuts, payload webhook, captures).

## Chantier 4 — Reste (modification configuration)

La modification de configuration entre cycles est **déjà livrée** (migration `group_edit_window` + UI `GroupSettings`). Je vérifie simplement en pratique pendant le chantier 3 que :
- L'organisateur peut bien modifier le nom/description en cours de cycle.
- Les champs structurels sont bien verrouillés avec icône cadenas.
- Si rien à corriger : pas de changement code.

---

## Détails techniques

**Migration SQL chantier 2** :
```sql
create or replace function public.request_group_deletion(_group_id uuid, _reason text)
returns uuid ...
-- Ajout en début :
v_has_payments := exists (
  select 1 from payments p
  join contributions c on c.id = p.contribution_id
  where c.group_id = _group_id and p.status = 'succeeded'
);
v_status := case when v_has_payments then 'pending_members' else 'pending_admin' end;
v_deadline := case when v_has_payments then now() + interval '48h' else now() end;
```

**Fichiers touchés** :
- Nouveau : `docs/UX_AUDIT.md`, `docs/DJOMY_LIVE_TEST.md`, migration suppression fast-track.
- Refonte : `src/components/layout/DesktopSidebar.tsx`, `src/components/layout/BottomNav.tsx`, `src/pages/GroupDetail.tsx` (regroupement en 5 onglets), `src/pages/Dashboard.tsx` (simplification), `src/components/group/DeletionPanel.tsx`.
- Routes `App.tsx` : `/cotisations` → `/payer`, `/recus` fusionné dans `/historique`, redirections legacy.
- Backend : `request_group_deletion` (fast-track), aucune autre fonction Djomy modifiée.

**Ce que je ne fais PAS dans ce plan** :
- Pas de refonte visuelle (couleurs, typo, animations) — uniquement réorganisation/regroupement.
- Pas de nouvelles fonctionnalités payment au-delà du test live.
- Pas de modification du back-office admin plateforme (déjà OK).

## Validation à la fin

- Build vert + invariants tests (`tontine-invariants.test.ts`) toujours OK.
- Captures Playwright du nouveau menu (desktop + mobile).
- File d'admin `/admin/suppressions` montre les demandes d'Alice prêtes à valider.
- Rapport Djomy avec preuve du débit réel.
