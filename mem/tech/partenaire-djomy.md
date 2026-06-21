---
name: Partenaire paiement Djomy
description: Agrégateur de paiement Mobile Money guinéen retenu pour Orange Money + MTN MoMo Guinée
type: reference
---
**Partenaire payments retenu : Djomy** (https://developers.djomy.africa/)

- Agrégateur guinéen unifié Orange Money + MTN MoMo Guinée
- Auth : OAuth client credentials (DJOMY_CLIENT_ID, DJOMY_CLIENT_SECRET)
- Sandbox disponible
- Capacités utiles : create_payment_gateway, confirm_otp, payment links, QR
- Spécifications de référence : https://github.com/afrotools/afrotools/tree/main/specs/payment/djomy

**À demander au user quand on attaque Phase 4 (paiements) :**
1. Credentials sandbox (DJOMY_CLIENT_ID + DJOMY_CLIENT_SECRET) à stocker via add_secret
2. URL de webhook à configurer côté Djomy → edge function `djomy-webhook`
3. Confirmation des montants min/max et frais appliqués

**Ne PAS recommander d'alternative** (CinetPay, FedaPay, PayDunya, LigdiCash) : décision déjà prise.

**Conventions d'intégration (à respecter) :**
- Endpoint utilisé : `POST /v1/payments/gateway` (page Djomy avec choix du moyen).
- `amount` : nombre positif **en GNF entiers** (pas de centimes — confirmé par la doc Djomy).
- `allowedPaymentMethods` : envoyer `["OM","MOMO","CARD"]` par défaut. Le payeur choisit OM, MoMo ou carte Visa/Mastercard directement sur le portail Djomy. **Ne pas** ré-implémenter cette sélection côté app (doctrine : un clic = une redirection).
- Pas de modale intermédiaire côté front. Le bouton « Payer » appelle `launchDjomyCheckout(contributionId)` et redirige vers `redirectUrl`.
- Pas de « mode test » visible utilisateur : la doctrine interdit toute esthétique de bac à sable. Les tests se font en sandbox via le tableau de bord `/admin/djomy`.
