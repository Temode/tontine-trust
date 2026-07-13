## Audit — ce qui casse aujourd'hui

**1. `CallRequestDialog`** (`sm:max-w-md`) — OK en soi, mais quand il bascule sur `MicPermissionGate` le contenu déborde le viewport (voir #2).

**2. `MicPermissionGate`** (525 l., affichée dans un `Dialog` puis dans la salle d'appel)
- Contenu très long : preview vidéo aspect-video + 2 tuiles statut + 3 gros boutons + checklist 6 lignes + tips + footer.
- Le `DialogContent` n'a pas de `max-h`/`overflow` → sur mobile (et même laptop 800 px) le bas (boutons Annuler/Continuer) est **inaccessible**.
- Padding `px-6 py-8` + `max-w-md` = marges cassées dans le Dialog (double padding).

**3. `CallRoom`** (dialog plein écran)
- **Footer** : 6 contrôles (mute, cam, screen, record avec libellé long "Consentements 2/3", diag, Quitter avec libellé) alignés `flex justify-center gap-4` → **wrap sale ou débordement horizontal < 420 px**. Le bouton record change de largeur selon l'état = layout instable.
- **Header** : `groupName + topic` à gauche, puis REC + dot + label statut + durée à droite = **débordement sur mobile étroit**, pas de troncature.
- **Body** : `px-6 py-8` figé, pas de safe-area iOS ; le diagnostic drawer est empilé sous les tuiles → oblige un scroll long.
- Pas de `env(safe-area-inset-bottom)` : la barre de contrôles est masquée par la home-bar iOS.

**4. `IncomingCallScreen`** (portail plein écran)
- Avatar `h-44 w-44` + titre `text-3xl` + gros CTA `h-20 w-20` sur `min-h` implicite → sur mobiles courts (iPhone SE, Android 640 px) **le bouton "Rejoindre" passe sous la home-bar**.
- Utilise `inset-0` sans `min-h-dvh` ni safe-area.

**5. `CallParticipantTile`** — OK, mais grille parent `grid-cols-2 sm:grid-cols-3 max-w-3xl` : sur écran > 1280 px les tuiles restent minuscules et perdues au centre.

---

## Corrections proposées

### A. `MicPermissionGate` — rendre scrollable et compacte
- Envelopper le contenu dans un conteneur `max-h-[85dvh] overflow-y-auto` (le `DialogContent` reçoit `p-0` pour éviter le double padding, la modale entière tient dans 85 dvh avec scroll interne).
- Réduire les paddings : `px-5 py-6` (au lieu de `px-6 py-8`) et `gap-4` (au lieu de `gap-5`).
- **Rendre la "Checklist diagnostique" repliable** (fermée par défaut, chevron pour ouvrir) → gain d'espace immédiat sur mobile.
- Réduire la preview à `max-h-56` en mobile (portrait) pour laisser la place aux CTA.
- Footer sticky : `sticky bottom-0 bg-background pt-3 border-t border-hairline` pour que "Continuer" reste toujours visible.

### B. `CallRoom` — footer mobile-first + header condensé
- **Footer refactor** (`flex-wrap` interdit → on regroupe par cluster) :
  ```text
  Mobile (<640): grille 4 icônes principales (mute/cam/screen/quitter),
                 record + diag dans un menu "…" (Sheet).
                 Bouton Quitter icône seule sur mobile, avec libellé ≥ sm.
  ≥ sm:         layout actuel amélioré (gap-3, boutons uniformes h-11).
  ```
- Réduire toutes les icônes à `h-11 w-11` (au lieu de 12) pour uniformiser avec les tokens shadcn.
- Bouton record : label court "REC" en mobile (au lieu de "Consentements 2/3") ; le compteur passe dans un tooltip / description sous l'icône.
- Ajouter `pb-[env(safe-area-inset-bottom)]` sur le footer.
- **Header** : `flex-col gap-1 sm:flex-row sm:items-center sm:justify-between`, `truncate` sur `groupName`, masquer le libellé "En direct/Connexion…" en < sm (garder juste le dot + durée).
- Body : `px-4 sm:px-6 py-6`, garder scroll interne, retirer `max-w-3xl` figé → utiliser `max-w-5xl` pour respirer sur desktop large.
- Le "diagnostic drawer" passe en `Sheet` latéral (droite) au lieu d'être empilé dans le flux → moins de scroll, cohérent avec la doctrine "une seule vue active".

### C. `IncomingCallScreen` — safe-area + compacité verticale
- `min-h-dvh`, `pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]`.
- Avatar : `h-32 w-32 sm:h-40 sm:h-40` (au lieu de `h-44` fixe).
- Titre : `text-2xl sm:text-3xl`.
- CTA Rejoindre : `h-16 w-16 sm:h-20 sm:w-20`, écart entre boutons `gap-16 sm:gap-24` (plus lisible que `justify-around`).

### D. `CallRequestDialog` — cohérence
- `DialogContent` : `max-h-[90dvh] overflow-y-auto` pour héberger le `MicPermissionGate` sans clipping.
- Boutons footer : `flex-col-reverse gap-2 sm:flex-row sm:justify-end` (le CTA primaire en bas sur mobile = pouce accessible).

### E. Grille des tuiles participants (`CallRoom`)
- `grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`, `max-w-6xl`, `gap-3 sm:gap-4`.
- Sur mobile portrait, tuiles pleine largeur = visages lisibles.

---

## Fichiers touchés

- `src/components/messages/MicPermissionGate.tsx` — scroll interne, checklist repliable, paddings, footer sticky.
- `src/components/messages/CallRoom.tsx` — header/footer responsive, safe-area, grille tuiles, diagnostic en Sheet.
- `src/components/messages/CallRequestDialog.tsx` — `max-h-[90dvh] overflow-y-auto` + footer mobile.
- `src/components/messages/IncomingCallScreen.tsx` — safe-area, tailles adaptatives.
- (Aucun changement logique / RPC / hook `useWebRTCCall` — pure UI.)

## Hors périmètre

- Pas de changement de logique WebRTC, signaling, enregistrement, RLS.
- Pas de refonte visuelle de la doctrine (couleurs, typo, tokens inchangés).
- `CallDiagnosticPanel` (bouton flottant) : déjà responsive, pas touché.
