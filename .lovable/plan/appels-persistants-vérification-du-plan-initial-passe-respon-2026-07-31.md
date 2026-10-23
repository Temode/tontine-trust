# Appels persistants : vérification du plan initial + passe responsive

## Ce qui est bien livré (vérifié dans le code)

- `src/hooks/CallContext.tsx` : provider global monté dans `AppShell`, un seul `<LiveKitRoom>` rendu via portail sur `document.body`, jamais démonté lors d'un changement de route ni de mode.
- Plus aucun `Dialog` : overlay plein écran `fixed inset-0 z-[80]`, aucune fermeture au clic sur le fond.
- `Échap` réduit en mini-player au lieu de raccrocher ; `beforeunload` averti.
- Mini-player draggable (`CallMiniPlayer.tsx`) avec vidéo du speaker actif, durée, micro, PiP, Agrandir, Raccrocher.
- Bandeau « Appel en cours — durée · Revenir » en mode réduit.
- PiP natif : hook `usePictureInPicture`, bouton conditionné à `pictureInPictureEnabled`, auto-PiP sur `visibilitychange`.
- Les 4 points d'entrée (`IncomingCallScreen`, `IncomingCallSheet`, `CallRequestDialog`, `CallHistoryDrawer`) passent par `useCall().startCall`, l'ancien `CallRoom.tsx` est supprimé.
- Un seul appel à la fois, `RoomAudioRenderer` dans le provider, cycle de vie serveur inchangé.

## Écarts restants par rapport au plan initial

1. **Confirmation avant raccrochage** quand d'autres participants sont présents : absente. À ajouter dans `ControlDock` (petit popover de confirmation, pas de dialog bloquant), et sur le bouton rouge du mini-player.
2. **Aimantation aux coins** du mini-player : actuellement la position est seulement bornée à l'écran. Ajouter le snap au coin le plus proche au relâchement, avec transition.
3. **`startCall` sur un autre appel actif** : affiche un toast d'erreur au lieu de « proposer de basculer ». Remplacer par un toast avec action « Basculer » qui raccroche l'appel courant et démarre le nouveau.
4. **Mode `pip`** : le type `CallMode` est `"full" | "mini"`, l'état PiP est suivi séparément. Exposer `mode: "pip"` quand `document.pictureInPictureElement` est actif, pour rester conforme au contrat annoncé.

## Passe responsive

- **Bandeau appel actif** : posé en `top-0 z-[84]`, il recouvre le header de l'app sur mobile. Le décaler sous la zone safe-area (`top-[env(safe-area-inset-top)]`) et ajouter un décalage du contenu, ou l'ancrer au-dessus de la `BottomNav` sur mobile.
- **Mini-player** : largeur fixe 200 px. Passer à une largeur fluide bornée (`w-[min(46vw,200px)]`, hauteur média proportionnelle) pour les petits écrans (320–360 px), et recalculer les bornes de drag au `resize` / rotation (actuellement la position mémorisée peut sortir de l'écran après rotation).
- **Overlay plein écran** : vérifier le dock sur mobile — un bouton (partage d'écran) est masqué en dessous de `sm`, mais le dock peut déborder à 320 px. Passer le dock en `flex-wrap` / réduire le gap sous `sm`, et utiliser `min-h-[100dvh]` + safe-areas haut/bas comme sur `IncomingCallScreen`.
- **Panneau modération** : `w-72` fixe en `absolute right-3` → passer en `w-[min(18rem,calc(100vw-1.5rem))]`.
- **Carrousel / grille participants** : contrôler le rendu à 1, 2, 3 et 5 participants en 375 px et 768 px.

## Vérification

Script Playwright sur `/messages` en viewports 360×740, 768×1024 et 1280×800 : ouverture de l'overlay, réduction, drag du mini-player, retour plein écran, captures d'écran à chaque étape. Aucun changement backend.
