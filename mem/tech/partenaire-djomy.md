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
