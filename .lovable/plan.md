# Plan — Reprise du test bout en bout (après migration 10)

Migration `db/10_pending_members_visibility.sql` confirmée exécutée. Reprise du test E2E avec les comptes déjà créés.

## Étapes

1. **Compte B (Bob)** — toujours connecté
   - Recharger `/groupes` → vérifier que le groupe "Tontine Test G" apparaît en **statut pending**.
   - Ouvrir le groupe → vérifier qu'il s'affiche (au lieu de "Groupe introuvable"), avec un indicateur d'attente d'approbation.

2. **Re-test du flux code manuel**
   - (Optionnel) Revoir l'auto-format + le toast "Demande envoyée" si on rejoue un code.

3. **Compte A (Alice — organisatrice)**
   - Se reconnecter (alice.tontine.test+a@example.com).
   - Vérifier le compteur "membres actifs" du header (point d'audit incohérence 0 vs 1).
   - Onglet **Membres** → voir Bob en `pending` + boutons Approuver/Rejeter.
   - Approuver Bob → vérifier passage à `active` + notification générée.

4. **Retour Bob**
   - Recharger → statut passe à `active`, accès complet au groupe.
   - Vérifier la notification "candidature acceptée".

5. **Cas d'erreur**
   - Saisir un code invalide → message d'erreur explicite.

## Livrable

Rapport synthétique avec captures :
- ce qui fonctionne après migration 10,
- bugs résiduels (si l'incohérence "0 membres actifs" persiste, plan de correctif ciblé),
- recommandations restantes (KPI mock-data sur Mes groupes).

## Hors scope

Paiements Orange/MTN, refonte annuaire, performance.
