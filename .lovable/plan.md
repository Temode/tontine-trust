# Rendre le KYC optionnel pour rejoindre une tontine

## Constat de l'audit

Aujourd'hui, la vérification d'identité (KYC) est **bloquante** à deux endroits pour rejoindre un groupe :

1. **Frontend** — `src/components/join-group/JoinFlow.tsx`
   - Requête `getMyKyc` + `listKycLevels` au chargement du dialogue.
   - Encart d'alerte « Vérification d'identité requise » (bandeau ambre avec bouton « Vérifier mon identité »).
   - Bouton « Confirmer mon adhésion » désactivé si `kycBlocked = true` (cotisation > plafond du palier KYC).

2. **Backend** — RPC `public.join_group_with_code` (dernière définition dans la migration `20260623023245_...sql`, lignes 233–273)
   - Charge `profiles.kyc_level`, compare la cotisation au `max_contribution_amount` du palier, et lève `RAISE EXCEPTION 'KYC_INSUFFICIENT'` si dépassé.
   - Cette exception remonte au client même si l'UI est masquée → adhésion impossible.

La modale rapide `JoinGroupDialog` (aperçu par code) n'affiche déjà rien de KYC : rien à changer.

## Ce que je vais faire

### 1. Frontend — `src/components/join-group/JoinFlow.tsx`
- Supprimer les requêtes `kycQ` / `levelsQ` et les imports associés (`getMyKyc`, `listKycLevels`, icône `BadgeAlert`, `Link` s'il n'est plus utilisé).
- Retirer complètement le bloc d'alerte « Vérification d'identité requise » (lignes 185–208).
- Retirer `kycBlocked` de la condition `disabled` du bouton de confirmation et du style conditionnel.
- Aucun autre changement UX/visuel : le flux « Rejoindre » devient purement consentement + opérateur + message.

### 2. Backend — nouvelle migration SQL
Redéployer `public.join_group_with_code` à l'identique **sauf** que le bloc de vérification KYC (chargement de `v_kyc_level`, `v_cap` et le `RAISE EXCEPTION 'KYC_INSUFFICIENT'`) est retiré. Le reste (invitation, quorum, terms, insertion `group_members`) est inchangé.

### 3. Nettoyage léger
- Laisser en place la page `/profil/kyc`, la table `kyc_levels_config`, la logique KYC côté admin et le libellé `KYC_INSUFFICIENT` dans `RPC_ERROR_LABELS` : le KYC restera activable plus tard sans nouveau schéma.
- Mettre à jour la mémoire projet pour rappeler que le KYC est **désactivé volontairement** à l'adhésion (design decision temporaire) afin d'éviter une future régression.

## Hors périmètre

- Aucune modification des tests existants qui ne testent pas ce chemin.
- Aucun changement à `JoinGroupDialog` (aperçu code) ni aux quick actions.
- Pas de suppression de la page KYC ni des composants d'upload : réversibilité totale.

## Détails techniques

Migration attendue (résumé) :

```text
CREATE OR REPLACE FUNCTION public.join_group_with_code(...)
  → identique à la version actuelle
  → supprime uniquement :
      SELECT kyc_level ... ; v_kyc_level := COALESCE(...);
      SELECT max_contribution_amount ... ;
      IF v_amount > COALESCE(v_cap, 0) THEN RAISE 'KYC_INSUFFICIENT'; END IF;
```

Après approbation, je pousse la migration puis j'édite `JoinFlow.tsx`.
