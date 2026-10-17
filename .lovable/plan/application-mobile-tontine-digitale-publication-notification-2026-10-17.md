# Application mobile Tontine Digitale : publication, notifications push, confort sur petit écran

## 1. Préparation à la publication (Google Play et App Store)
- Identifiant définitif de l'app : `com.tontinedigitale.app`, nom affiché « Tontine Digitale » (remplace l'identifiant provisoire, qui ne pourra plus changer une fois publié).
- Réglage de production : l'app embarque sa propre version au lieu d'afficher la version de développement en direct. Le réglage « direct » reste disponible uniquement pour les tests.
- Icône de l'app (bleu sarcelle et or, reprise du logo actuel) et écran de démarrage, générés dans toutes les tailles Android et iPhone.
- Couleur de la barre d'état et du fond assortie à la marque, gestion des encoches et de la barre de navigation Android.
- Bouton « retour » Android : revient à l'écran précédent, ferme l'app depuis l'accueil.
- Guide pas à pas (en français) pour créer les comptes développeur, signer l'app et l'envoyer sur les deux stores.

## 2. Notifications push (même app fermée)
- Utilisation de Firebase Cloud Messaging (gratuit), qui couvre Android et iPhone. Vous connecterez votre projet Firebase via une carte de connexion ; pour l'iPhone, il faudra ajouter la clé Apple dans Firebase (expliqué dans le guide).
- À la première ouverture, l'app demande l'autorisation d'envoyer des notifications, puis enregistre le téléphone du membre.
- Chaque notification déjà créée dans l'app (cotisation due, paiement reçu, tour de réception, relance de cycle, messages, appels…) part aussi en push, en respectant les préférences de notifications existantes, avec un nouvel interrupteur « Notifications push ».
- Toucher une notification ouvre directement le bon écran (groupe, paiement, discussion).
- Les téléphones désinstallés sont nettoyés automatiquement.

## 3. Confort sur petits écrans
- Barre de navigation du bas revue : 5 entrées claires, zones de toucher plus grandes, respect de la zone du bas de l'iPhone.
- Audit et correction des écrans principaux sur 360 px de large : Tableau de bord, Mes groupes, Détail d'un groupe, Cotisations, Solde, Discussions, Profil, Abonnement.
- Fenêtres et formulaires qui tiennent dans l'écran avec le clavier ouvert, textes et montants qui ne débordent plus, boutons d'action principaux accessibles au pouce.
- Vérification par captures d'écran sur tailles Android et iPhone.

## Ce dont j'aurai besoin de vous
- Un projet Firebase (je vous guide pour le créer et le connecter).
- Plus tard, vos comptes Google Play (25 $ une fois) et Apple Developer (99 $/an) pour la publication.

## Détails techniques
- Plugins : `@capacitor/push-notifications`, `@capacitor/splash-screen`, `@capacitor/status-bar`, `@capacitor/app`, `@capacitor/assets` (génération icônes/splash depuis `resources/`).
- `capacitor.config.ts` : `server.url` conditionné à une variable d'environnement de dev ; config SplashScreen/StatusBar.
- Table `push_tokens` (user_id, token, platform, last_seen) avec RLS par utilisateur + GRANTs.
- Edge function `send-push` appelée via une outbox (pas d'appel HTTP dans un trigger, conformément à la doctrine SMS) ; envoi FCM HTTP v1 via la passerelle connecteur ; suppression des tokens UNREGISTERED.
- `dispatch_notification` alimente l'outbox push ; préférence `push_enabled` ajoutée aux préférences.
- Hook client `usePushRegistration` monté dans AppShell, actif uniquement en natif (`Capacitor.isNativePlatform()`), gestion du clic → navigation.
- Utilitaires `safe-area-inset` dans le CSS, `BottomNav` et dialogues ajustés.
