# Écran d'appel web desktop (à partir de 768 px) — reproduction de la maquette

Référence : `desktop.html` (reçu et lisible). `desktop.png` n'est pas arrivé dans ce fil ; les mesures seront prises dans le HTML rendu par navigateur, pas dans la transcription.

## Ce qui change pour l'utilisateur
- Sur ordinateur, l'appel devient un panneau centré de 520 px devant l'application assombrie, qui ne s'étire plus.
- Un partage d'écran sans caméra est enfin visible, et reste sur l'écran audio (pas de grille de vignettes grises).
- Quand un autre partage : panneau de 1120 px, surface partagée au centre, identité en en-tête.
- Quand c'est moi qui partage : panneau et voile disparaissent, barre compacte en bas (26 px du bas) avec « Arrêter », micro, participants, raccrocher. Aucun cadre dessiné dans la page.
- La bande des autres membres n'apparaît qu'à partir de 3 participants.
- Plus jamais d'adresse e-mail ni d'identifiant technique : sans nom → nom de la tontine en titre, « Un membre » en sous-titre.
- La durée n'apparaît qu'à l'arrivée du premier participant distant ; avant, l'état de sonnerie s'affiche.
- Téléphone (< 768 px) : strictement inchangé.

## Étapes
1. Ouvrir `desktop.html` dans Playwright, relever les mesures des 4 états (panneau simple, membre sans nom, partage par un autre, partage par moi) et les confronter au brief ; signaler tout écart avant de coder.
2. Token d'état actif : aucun n'existe pour `#BDE3E7` ; ajouter `--call-active` (HSL vérifié par conversion) dans `src/index.css` + `tailwind.config.ts`.
3. `CallContext.tsx` : repli d'identité sans `user.email` (nom vide ou contenant `@` → « Un membre ») ; aiguillage : caméra active → grille, sinon partage actif ou non → `AudioCallStage` ; détection `Track.Source.ScreenShare` ; horodatage `remoteJoinedAt` au premier participant distant, transmis à `useCallTimer` (bandeau « Appel en cours » inclus), arrêt au raccrochage.
4. `AudioCallStage.tsx` : repli `p.identity` supprimé ; bande conditionnée à ≥ 3 ; variantes `md:` uniquement (panneau, avatar 136, nom 25, dock 6 boutons de 50 espacés de 14, raccrocher 56×50, pastille participants cliquable) ; deux états de partage ; toutes les icônes en `viewBox="0 0 24 24"`.
5. Vérification Playwright à 1280 et 412 px : comparaison des mesures listées par Mr. Claude, capture avant/après mobile identique au pixel, partage sans caméra resté en audio.

## Points à arbitrer avant code
- Voile `rgba(4,26,29,.80)` et ombres `rgba(0,0,0,.42/.34)` : valeurs hors tokens. Proposition : les ajouter en tokens (`--call-scrim`, `--shadow-call-panel`, `--shadow-call-bar`), mais le brief limite les nouveaux tokens à l'état actif. À confirmer.
- DM Sans n'est pas encore installée (consigne précédente) : la police système sera utilisée jusqu'à la mise en place du fichier, sauf instruction contraire.

## Hors périmètre (non touché)
Mobile < md, écrans Android natifs, statuts et cycle de vie d'appel, permission micro, `CallStage`/`FocusStage` hors aiguillage, paiements, autres tokens.
