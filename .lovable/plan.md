## Objectif
Vérifier que les compteurs et listes de membres s'affichent enfin, puis dérouler la fin du scénario d'approbation Alice → Bob.

## Étapes

1. **Bob (pending)** — recharger `/groupes/:id` de "Tontine Test G"
   - Vérifier compteur "membres actifs" ≥ 1 (Alice)
   - Vérifier que Bob apparaît dans la liste avec badge `pending`
   - Plus d'erreur PostgREST 400 / PGRST200 dans la console

2. **Alice (organisatrice)** — se reconnecter
   - Aller sur le groupe → onglet Membres
   - Voir Bob en `pending` avec boutons Approuver / Refuser
   - Cliquer **Approuver** → vérifier transition `active` + toast + notification créée pour Bob

3. **Bob** — recharger
   - Statut passé à `active`, badge INSCRIPTION disparu
   - Notification "candidature acceptée" visible
   - Accès complet aux données du groupe (tours, contributions)

4. **Cas d'erreur** — code invalide saisi manuellement → message d'erreur explicite

5. **Livraison** — rapport synthétique :
   - Ce qui fonctionne après migrations 09/10/11
   - Bugs résiduels (ex. KPI mock-data sur "Mes groupes", incohérence éventuelle compteurs)
   - Recommandations restantes

## Hors scope
Paiements Orange/MTN, refonte annuaire, optimisations perf.
