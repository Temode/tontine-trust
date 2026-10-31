# Appels prioritaires et diagnostic audio

## Constats avant modification

- Appel en cours : niveau 80 ; chargement sur `/appel` : 90 ; appel entrant : 100.
- Visite guidée : 100, donc au-dessus de l'appel en cours et à égalité avec l'appel entrant.
- Deux autres familles concurrencent visuellement l'appel : Toaster classique à 100 et Sonner à 999 999 999 (valeur du paquet installé).
- Dialogues, confirmations, panneaux latéraux et tiroirs : 50 ; navigation et bandeau hors ligne : 40. Ils ne dépassent pas visuellement les écrans d'appel, mais les fenêtres modales peuvent conserver le focus et bloquer les clics.
- Les journaux détaillés du précédent essai audio ne sont pas conservés. Cause des reconnexions et rétablissement automatique non établis. Ne pas transformer l'absence de traces en diagnostic réseau.

## Modifications proposées

1. Définir une priorité commune aux écrans d'appel entrant, de connexion et en cours, supérieure aux surfaces ordinaires. Encadrer explicitement les deux Toasters au lieu de rivaliser avec la valeur extrême de Sonner.
2. Mettre la visite guidée en pause à l'arrivée d'un appel et pendant une session, y compris réduite ou en reconnexion. Conserver son étape pour reprendre après la fin, sans scrolling ni mesure périodique pendant l'interruption. Empêcher un démarrage automatique pendant l'appel.
3. Rendre les surfaces modales ordinaires invisibles et inertes pendant un appel plein écran, sans les démonter ni modifier leur état d'ouverture. Préserver les saisies, suspendre leur capture du focus et empêcher les clics extérieurs ou Échap de les fermer. Restaurer contenu et focus après l'appel. Préserver les panneaux propres aux commandes de l'appel et ne déclencher aucune demande système supplémentaire.
4. Reproduire un appel audio réel entre les comptes de test avec traces horodatées des deux clients : connexion, reconnexion, déconnexion et raison, erreurs, obtention d'accès, état réseau, pistes audio et octets reçus. Interrupteur explicitement activé pour l'essai, réservé au développement et désactivé par défaut ; aucune nouvelle trace détaillée en production. Ne conserver aucun jeton ni identifiant secret dans les traces.
5. Rapporter le résultat observé : cause démontrée, reprise automatique ou échec, et distinction entre connexion à la salle et réception audio effective. Si le résultat est non concluant, nommer chaque preuve manquante, sur quel client la collecter, et quelle trace LiveKit Cloud corréler. Ne modifier ni LiveKit ni le comportement de reprise sans preuve d'un défaut.

### Zone de messages — rendu soumis à validation avant code

- Position : dans le flux de l'écran, entre les informations d'appel et les commandes, en audio comme en vidéo ; emplacement équivalent avant les commandes de sonnerie.
- Une phrase concise sur deux lignes maximum, sans recouvrir avatar, participants ou boutons. Tokens et typographie existants, aucun effet décoratif.
- Exemples : « Micro indisponible. Vous pouvez continuer à écouter. » ; « Connexion perdue. Reconnexion en cours… » ; « La connexion n'a pas pu être rétablie. »
- Actions contextuelles : « Réessayer » quand possible et « Terminer » si nécessaire, avec les composants de commande existants.
- Couvrir refus/absence/occupation du micro, activation caméra, sortie audio, perte réseau, reprise et obtention d'un nouvel accès. Échec de Refuser visible dans l'écran entrant.
- Remplacer le bandeau flottant de reconnexion. Après un échec définitif, conserver un écran d'erreur lisible jusqu'à fermeture, sans laisser croire que l'appel continue.
- Cette zone n'est pas implémentée avant validation du rendu proposé.

## Vérifications

- Tester visite en cours → appel entrant → décrocher → appel en cours → raccrocher → reprise à la même étape.
- Vérifier clics et clavier avec une fenêtre modale déjà ouverte, ainsi que les deux systèmes de notifications.
- Saisir une contribution dans une modale, recevoir l'appel, interagir avec ses commandes, puis vérifier la même valeur et le focus restaurés après raccrochage ; vérifier que la modale n'a jamais été démontée.
- Vérifier les commandes propres à l'appel, la réduction et les états de connexion/erreur.
- Contrôler le rendu sur ordinateur et petit écran ; conserver les tests de non-régression.
- L'essai sandbox n'atteste pas du son sur TECNO. Le test physique reste nécessaire, mais ce chantier n'exige pas de recopier des fichiers Java.

## Détails techniques

- Employer des niveaux sémantiques centralisés dans le système existant et des portails isolés pour les surfaces d'appel.
- Rendre l'état entrant/session accessible à la visite sans recréer la salle LiveKit. Examiner aussi les restrictions Radix (focus, aria-hidden et pointer-events), pas uniquement les z-index.
- La pause est une suspension de la visite, pas une marque de visite terminée.
- LiveKit est une architecture SFU : chaque client rejoint le serveur. Une sortie réseau commune ne suffit pas à expliquer une négociation défaillante entre les deux participants.
- L'accès émis a une durée de quatre heures ; cette configuration seule ne prouve ni n'exclut une erreur de jeton dans l'essai précédent.
- Si une collecte TECNO devient nécessaire : inspecter la WebView depuis Chrome `chrome://inspect` et relever événements LiveKit horodatés, état ICE, pistes et octets audio. Collecter les mêmes données sur l'autre client. Corréler avec les journaux de la session/salle dans LiveKit Cloud ; préciser si cet accès n'est pas disponible plutôt que l'affirmer acquis.

## Périmètre

Priorité des appels, pause de visite, messages intégrés et diagnostic audio uniquement. Aucun changement Android natif, couleur, permission, paiement ou statut métier d'appel. Le reste du plan est approuvé ; le rendu proposé de la zone de messages reste à valider avant son implémentation.