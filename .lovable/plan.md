# Parcours utilisateur Tontine Digital — découpage par phases

Contexte clé : usage réel, vrai argent. Donc chaque étape doit être robuste, traçable, auditable. Pas de mock dans les flux financiers. On avance phase par phase, on ne passe à la suivante que quand la précédente est solide.

---

## Parcours utilisateur complet (de l'inscription au cycle terminé)

```text
1.  Découverte         → page d'accueil publique, explication, CTA "S'inscrire"
2.  Inscription        → numéro de téléphone + OTP SMS, nom, PIN
3.  Profil             → photo, vérification d'identité (optionnelle MVP)
4.  Onboarding         → 2 choix : "Créer un groupe" ou "Rejoindre avec un code"

— Branche A : Organisateur —
5A. Création groupe    → nom, montant, fréquence, nb membres, règles rotation/pénalités
6A. Code d'invitation  → généré, partageable (SMS, WhatsApp, lien)
7A. Attente quorum     → suivi des inscriptions, relance, validation/refus des candidats
8A. Démarrage cycle    → tirage de l'ordre de rotation, planification du 1er tour

— Branche B : Participant —
5B. Saisie code        → prospectus du groupe (règles, organisateur, score)
6B. Candidature        → demande d'adhésion, attente validation
7B. Confirmation       → notification, accès au groupe

— Tronc commun (cycle actif) —
9.  Notification J-2   → "votre cotisation est due le ..."
10. Paiement           → Orange Money / MTN Money via redirection ou USSD
11. Confirmation paiement → reçu numérique horodaté, mise à jour du tableau de bord
12. Collecte complète  → toutes les cotisations reçues → cagnotte constituée
13. Versement bénéficiaire → transfert Mobile Money automatique vers le bénéficiaire du tour
14. Reçu de versement  → preuve cryptographique, journal d'audit
15. Tour suivant       → boucle 9-14 jusqu'à ce que tous les membres aient reçu
16. Fin de cycle       → bilan, score de fiabilité mis à jour, option "relancer un cycle"

— Transverse —
*   Profil & score de fiabilité (ponctualité, ancienneté)
*   Historique / registre immuable
*   Notifications (push, SMS)
*   Litiges & support
```

---

## Découpage en phases (ce qu'on va construire)

### Phase 1 — Comptes & identité (socle)
Ce qui existe déjà : email/password via Lovable Cloud. À remplacer/compléter pour usage réel.
- Inscription par **numéro de téléphone + OTP SMS** (vrai SMS, pas mock)
- PIN à 4-6 chiffres pour reconnexion rapide
- Profil minimal : nom, téléphone, photo
- Page `/profil` : afficher info réelles + déconnexion (déjà MVP)
- **Score de fiabilité** : table dédiée, calcul automatique (départ 100%, ajusté à chaque cycle)

### Phase 2 — Groupes (déjà en place, à durcir)
État : création, invitation par code, adhésion fonctionnent (Phase B livrée).
À compléter :
- Validation/refus des candidatures par l'organisateur (workflow complet)
- Quorum atteint → bouton "Démarrer le cycle" → tirage rotation persisté en base
- Affichage clair de l'ordre des bénéficiaires dans `/groupes/:id`

### Phase 3 — Rotation & calendrier (cœur métier)
- Génération automatique du calendrier des tours à partir de la fréquence
- Table `rounds` : un enregistrement par tour, avec bénéficiaire, date prévue, statut
- Vue "Prochain tour" sur le dashboard (remplacer le placeholder actuel)
- Possibilité d'**échange de tours** entre membres avec accord (politique du groupe)

### Phase 4 — Paiements Mobile Money (le vrai sujet vrai argent)
**Le plus critique. À traiter avec le plus grand soin.**
- Intégration **Orange Money Guinée** (API officielle ou agrégateur type CinetPay, PayDunya, FedaPay)
- Intégration **MTN MoMo Guinée**
- Flux : déclencher une demande de paiement → l'utilisateur valide sur son téléphone → webhook de confirmation → enregistrement transaction
- Table `contributions` : statut (pending/paid/failed/refunded), référence opérateur, horodatage
- **Idempotence** obligatoire (pas de double prélèvement)
- Mode sandbox d'abord, puis bascule live après validation

### Phase 5 — Versement bénéficiaire (payout)
- Une fois toutes les cotisations d'un tour reçues → déclenchement automatique du payout via API Mobile Money
- Reçu numérique signé (PDF + entrée registre)
- Cas d'erreur : retry, escalade à l'organisateur, journal complet

### Phase 6 — Traçabilité & registre
- Journal d'audit immuable de chaque action sensible (création, paiement, versement, échange)
- Export CSV/PDF des relevés pour chaque membre et chaque groupe
- Vue "Historique" par groupe (uniquement quand il y a de vraies données — pas avant)

### Phase 7 — Notifications réelles
- SMS via le même provider que l'OTP : rappels J-2, confirmation paiement, notification versement
- Push web (optionnel) si on garde le web

### Phase 8 — Score de fiabilité (recalcul live)
- Algorithme basé sur : % de paiements à temps, ancienneté, nombre de cycles complétés
- Affichage sur le profil et visible par les organisateurs lors de la validation d'une candidature

### Phase 9 — Conformité & sécurité avant lancement
- KYC léger (au moins vérification identité pour l'organisateur de gros groupes)
- Limites de montants
- Conditions générales, mentions légales
- Audit de sécurité de la base, des RLS, des edge functions de paiement

---

## Questions à trancher avant de commencer la Phase 1

1. **OTP SMS** : quel provider ? Twilio (cher, fiable, international) ou un agrégateur local Guinée moins cher ?
2. **Mobile Money** : on attaque en direct Orange/MTN (long, contrats à signer) ou via un agrégateur (CinetPay, FedaPay, PayDunya) plus rapide à intégrer ? Recommandation forte : **agrégateur** pour démarrer.
3. **Périmètre du MVP de lancement** : on lance avec quoi exactement ? Ma proposition :
   - **MVP v1 (lançable)** : Phases 1, 2, 3, 4, 5, 6 minimum + 7 (SMS) + 9 (légal).
   - Score de fiabilité (Phase 8) en post-lancement (départ à 100% pour tout le monde).
   - Échange de tours en post-lancement.
4. **Web seulement** ou **+ app mobile React Native** au lancement ? La présentation parle des deux mais on a actuellement du web. Recommandation : **lancer en web responsive** (PWA), mobile native plus tard.

---

## Ce que je propose comme prochaine étape concrète

Commencer la **Phase 1 — Comptes & identité** : remplacer l'auth email/password par une auth par téléphone + OTP SMS, avec la table `profiles` enrichie (téléphone vérifié) et la table `reliability_scores`.

Avant que je touche au code, dis-moi :
- **Quel provider SMS** tu veux qu'on utilise (ou si tu veux que je te fasse une comparaison rapide Twilio vs agrégateur local) ?
- **OK pour démarrer par la Phase 1** ou tu préfères qu'on attaque autre chose en premier (ex : commencer par sécuriser Phase 2/3 sur l'existant avant de toucher à l'auth) ?
- **Agrégateur Mobile Money** : je creuse CinetPay / FedaPay / PayDunya pour te faire une reco ?

Une fois ces 3 réponses, je rentre en mode build et on enchaîne phase par phase, chaque phase étant elle-même découpée en sous-étapes vérifiables.
