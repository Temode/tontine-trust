# Plan — Re-test du flux invitation/adhésion

La migration `db/09_fix_membership_and_invitations.sql` est confirmée exécutée. Je vais relancer un audit bout en bout dans le navigateur avec deux comptes pour vérifier que les correctifs (Phase G) fonctionnent.

## Étapes

1. **Vérification BDD rapide** (`psql`)
   - Confirmer que `'pending'` existe dans l'enum `member_status`.
   - Confirmer que tout groupe a au moins une ligne `group_members` (organisateur, active).
   - Vérifier la policy `inv_select_organizer` sur `invitations`.

2. **Compte A — Organisateur**
   - Création compte test A (email jetable + mot de passe).
   - Création d'un nouveau groupe de tontine (montant, fréquence, taille).
   - Ouvrir le groupe : vérifier compteur membres = 1, pot cohérent.
   - Générer une invitation via `InvitePanel` : copier le **code** + le **lien** (`/rejoindre?code=…`).

3. **Compte B — Invité**
   - Déconnexion, création compte test B.
   - **Scénario 1 (code)** : aller sur `/rejoindre`, coller le code, vérifier longueur 12 acceptée, rejoindre.
   - **Scénario 2 (lien)** : ouvrir `/rejoindre?code=…`, vérifier auto‑remplissage + auto‑join.
   - Vérifier le statut résultant (`active` ou `pending` selon `require_manual_approval`).

4. **Retour compte A**
   - Si `pending` : approuver via UI, vérifier passage à `active` + notification.
   - Vérifier compteur membres = 2.

5. **Cas d'erreur**
   - Code invalide → message clair.
   - Code révoqué → message clair.
   - Accès direct à un groupe non-membre → erreur 403/404 explicite (pas de chargement infini).

## Livrable

Rapport synthétique : ce qui marche, ce qui reste cassé, captures à l'appui. Si bugs résiduels → correctifs ciblés (sans élargir le périmètre).

## Hors scope

Paiements Orange/MTN, refonte annuaire public.
