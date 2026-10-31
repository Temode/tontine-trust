# Décrocher ouvre directement l'appel en cours

## Objectif
Un appui sur Décrocher (écran natif) doit ouvrir l'écran audio de l'appel, pas l'accueil, que l'app soit fermée, en arrière-plan ou déconnectée.

## Changements
1. Sortir l'écoute des liens profonds de `AppShell` : un petit composant `NativeDeepLinkBridge` monté une seule fois au niveau racine (dans le routeur, `App.tsx`), pour qu'il soit actif sur toutes les pages.
2. Dans `useNativeApp`, au démarrage, lire `App.getLaunchUrl()` (cas app fermée) en plus de l'écoute `appUrlOpen` (cas app ouverte), puis traduire `com.tontinedigitale.app://appel/<id>` en navigation vers `/appel/<id>`.
3. Si l'utilisateur n'est pas connecté : mémoriser la destination, passer par la connexion, puis y revenir.
4. Ne traiter un même lien qu'une fois (pas de double ouverture d'appel).

## Vérification
- Build propre, test unitaire de la conversion lien profond -> chemin.
- Test réel sur le TECNO : appel lancé, Décrocher, arrivée sur l'écran audio à 6 commandes.

## Détails techniques
- Garde `Capacitor.isNativePlatform()` conservée.
- Aucun changement natif Android requis (le lien est déjà émis).
