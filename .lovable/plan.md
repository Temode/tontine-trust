## Audit constaté

- Le paiement Djomy de `moncomptepaypal5@gmail.com` existe bien côté webhook : événement `payment.success` reçu pour la transaction `13c3720c-24b7-4cb0-b8e9-9598960e1f36`.
- La ligne `user_subscriptions` est bien passée en `premium / active`, avec échéance au `09/08/2026`.
- Le problème visible dans l’application vient très probablement de deux faiblesses restantes :
  1. la fonction d’éligibilité choisit simplement la dernière ligne modifiée (`ORDER BY updated_at DESC`) et peut retomber sur une ligne `cancelled` si plusieurs lignes ont le même `updated_at` ;
  2. la page `/abonnement` utilise un cache d’éligibilité avec `staleTime: 60s`, donc après paiement elle peut encore afficher Free sans rafraîchissement manuel.
- Autre point critique : les webhooks Djomy enregistrés ont `signature_valid = false`, donc le webhook ne traite pas réellement l’activation ; l’activation actuelle vient de la réconciliation manuelle/status. Il faut auditer la vérification de signature Djomy pour ne pas dépendre uniquement du polling.

## Plan de correction

1. **Corriger la source de vérité des droits utilisateur**
   - Modifier la RPC `get_my_entitlements` pour sélectionner en priorité un abonnement `active` ou `trialing`, puis `past_due`, puis `pending`, et seulement ensuite `cancelled`.
   - Ajouter un ordre stable avec `updated_at DESC, created_at DESC` pour éviter qu’une ligne annulée avec le même timestamp masque le Premium actif.

2. **Rendre l’interface immédiatement cohérente après paiement**
   - Sur la page `/abonnement`, forcer un `refetch()` des entitlements au montage et/ou réduire le cache pour que le plan Premium apparaisse sans rechargement manuel.
   - Après succès sur `/abonnement/confirmation`, invalider/refetcher explicitement les entitlements pour que le dashboard et la page abonnement voient Premium immédiatement.

3. **Renforcer le webhook abonnement**
   - Vérifier pourquoi les événements Djomy reçus sont marqués `signature_valid = false`.
   - Ajuster la lecture du `metadata` : Djomy envoie le `metadata` au niveau racine dans les événements observés, alors que le code lit surtout `data.metadata`; cela peut empêcher le routage direct abonnement selon le payload.
   - Garder l’idempotence et l’activation atomique via `apply_subscription_webhook`.

4. **Compléter les tests**
   - Étendre les tests SQL pour couvrir la sélection `get_my_entitlements` quand un utilisateur a une ligne Premium active et des lignes Premium/Free annulées au même timestamp.
   - Ajouter un test webhook/scénario payload Djomy abonnement montrant que `merchantPaymentReference` + `metadata.purpose = subscription` active correctement Premium et ne recrée pas de doublon.

5. **Vérification finale**
   - Relire en base `moncomptepaypal5@gmail.com` après correction : confirmer une seule ligne active Premium.
   - Vérifier que `/abonnement` affiche Premium actif sans action manuelle côté utilisateur.
