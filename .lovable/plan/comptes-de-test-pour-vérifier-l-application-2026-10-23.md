# Comptes de test pour vérifier l'application

## Objectif
Garder les deux comptes fournis (comptea@yopmail.com, compteb@yopmail.com) pour tester l'application connecté, comme un vrai membre, avant chaque livraison.

## Ce qui sera fait
1. Enregistrer les identifiants comme secrets du projet (TEST_ACCOUNT_A_EMAIL / _PASSWORD, TEST_ACCOUNT_B_EMAIL / _PASSWORD). Les mots de passe ne seront jamais écrits dans le code, la mémoire ni le dépôt git : le dépôt est copié sur votre ordinateur et le mot de passe y serait lisible.
2. Ajouter à la mémoire du projet une règle : « Avant de déclarer un travail terminé, le tester connecté avec le compte A (et B quand deux membres sont nécessaires : invitation, cotisation, messagerie, parrainage) ». Seules les adresses email y figurent.
3. Vérifier tout de suite que les deux comptes se connectent (code email validé, accès au tableau de bord), puis refaire avec eux les vérifications des derniers correctifs : bouton « Poser une question », page Mes reçus, lien de parrainage ouvert par un membre déjà connecté, fin d'abonnement Premium.
4. Vous signaler tout problème trouvé pendant ces vérifications.

## Détails techniques
- Secrets lus seulement par les scripts Playwright du bac à sable (`os.environ`), jamais affichés ni capturés.
- Si un compte n'a pas validé son code (otp_verified), le signaler plutôt que de le contourner.
