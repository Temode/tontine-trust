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
3. Suspendre les surfaces modales ordinaires pendant un appel plein écran, pour libérer aussi les clics et le clavier. Préserver les panneaux propres aux commandes de l'appel et ne déclencher aucune demande système supplémentaire.
4. Reproduire un appel audio réel entre les comptes de test avec traces horodatées des deux clients : connexion, reconnexion, déconnexion et raison, erreurs, obtention d'accès, état réseau, pistes audio et octets reçus. Ne conserver aucun jeton ni identifiant secret dans les traces.
5. Rapporter le résultat observé : cause démontrée ou restant inconnue, reprise automatique ou échec, et distinction entre connexion à la salle et réception audio effective. Ne modifier ni LiveKit ni le comportement de reprise sans preuve d'un défaut.

## Vérifications

- Tester visite en cours → appel entrant → décrocher → appel en cours → raccrocher → reprise à la même étape.
- Vérifier clics et clavier avec une fenêtre modale déjà ouverte, ainsi que les deux systèmes de notifications.
- Vérifier les commandes propres à l'appel, la réduction et les états de connexion/erreur.
- Contrôler le rendu sur ordinateur et petit écran ; conserver les tests de non-régression.
- L'essai sandbox n'atteste pas du son sur TECNO. Le test physique reste nécessaire, mais ce chantier n'exige pas de recopier des fichiers Java.

## Détails techniques

- Employer des niveaux sémantiques centralisés dans le système existant et des portails isolés pour les surfaces d'appel.
- Rendre l'état entrant/session accessible à la visite sans recréer la salle LiveKit. Examiner aussi les restrictions Radix (focus, aria-hidden et pointer-events), pas uniquement les z-index.
- La pause est une suspension de la visite, pas une marque de visite terminée.
- LiveKit est une architecture SFU : chaque client rejoint le serveur. Une sortie réseau commune ne suffit pas à expliquer une négociation défaillante entre les deux participants.
- L'accès émis a une durée de quatre heures ; cette configuration seule ne prouve ni n'exclut une erreur de jeton dans l'essai précédent.

## Périmètre

Priorité des appels, pause de visite et diagnostic audio uniquement. Aucun changement Android natif, couleur, permission, paiement ou statut métier d'appel. Les modifications de priorité et de suspension attendent la validation de ce constat et du plan.