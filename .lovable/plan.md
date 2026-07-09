
## Objectif

Remplacer la page `/` (actuellement un placeholder "Welcome to Your Blank App") par la landing page fidèle à la maquette Figma fournie dans `Maquette_Figma_en_React.zip` → `TontineDigitale.jsx`.

## Portée

- **Seule la route `/`** (composant `src/pages/Index.tsx`) est touchée.
- Aucune autre page, aucun composant partagé (AppShell, sidebar, dashboard, etc.) n'est modifié.
- Aucun changement backend, aucun changement de routing (la route `/` existe déjà et n'est pas protégée).

## Fichiers modifiés

1. **`src/pages/Index.tsx`** — réécrit intégralement à partir de `TontineDigitale.jsx` (693 lignes, styles inline, fidèle pixel à la maquette : couleurs `#0D7377` teal / dark teal, typo Inter, sections Hero + mockup téléphone, Fonctionnalités, Comment ça marche, Sécurité, FAQ, CTA, Footer).

## Adaptations minimales sur le JSX fourni

Le fichier `TontineDigitale.jsx` est autonome mais suppose `React` global. Adaptations lors de la copie :

- Ajouter `import React from "react";` en tête + `import { Link } from "react-router-dom";`.
- Remplacer `React.useState` / `React.useEffect` par les hooks importés (ou garder `React.*` — les deux marchent).
- Wire des CTA "Commencer" / "Se connecter" / "Créer mon compte" → `<Link to="/auth">` au lieu de `<a href="#">`.
- Conserver **tous** les styles inline (`FONT`, palette `C`, dimensions) pour rester fidèle à la maquette. Pas de conversion en Tailwind/tokens — la fidélité prime.
- Conserver le hook `useVW()` responsive du fichier.
- Retirer le chargement dynamique de la police Inter du composant si présent (Inter est déjà chargé globalement) — sinon le laisser, sans conflit.

## Ce qui n'est PAS fait

- Pas de refonte des tokens design système (`src/index.css`, `tailwind.config.ts`) — la landing utilise ses propres styles inline, isolés du reste de l'app.
- Pas de redirection auto vers `/dashboard` si l'utilisateur est déjà connecté (comportement actuel préservé : la landing s'affiche à tous).
- Pas de modification du contenu textuel de la maquette.
- Pas d'extraction des sous-sections en composants séparés — le fichier reste monolithique pour rester 1:1 avec la source Figma.

## Vérification

- Ouvrir `/` dans le preview après implémentation.
- Comparer visuellement avec `screenshots/full.png` de la maquette.
- Vérifier qu'un clic sur le CTA principal amène bien vers `/auth`.
