
## Observations

- **`/auth` est déjà implémenté** (`src/pages/Auth.tsx` + `src/hooks/useAuth.tsx`) : onglets Connexion / Inscription, validation Zod client (email, mot de passe ≥ 8, nom ≥ 2, téléphone optionnel), validation serveur via Lovable Cloud Auth, création automatique du profil, redirection selon rôle (`super_admin` → `/admin/overview`, sinon `/dashboard`), gestion des erreurs traduites. **Rien à refaire** — je le laisse tel quel.
- Les CTA de la landing pointent tous vers `/auth` sans tenir compte de l'état d'authentification.
- La landing utilise des styles inline (fidélité 1:1 avec la maquette Figma), pas Shadcn/UI. Je vais donc conserver la palette et les espacements Figma tout en améliorant le responsive — l'énoncé "styles Shadcn/UI" ne s'applique pas ici (voir note plus bas).

## Portée

Un seul fichier touché : **`src/pages/Index.tsx`**. Aucun changement backend, aucun changement à `/auth`, aucun autre écran.

## 1. CTA sensibles à l'état d'authentification

- Lire `user` et `loading` via `useAuth()`.
- Ajouter un helper `ctaHref` :
  - non connecté → `/auth`
  - connecté → `/dashboard` (ou `/admin/overview` si `super_admin`)
- Appliquer à tous les CTA de la landing : "Commencer" (header), "Créer mon compte gratuit" (hero + CTA final), "Créer mon premier groupe" (comment ça marche).
- Header : quand l'utilisateur est connecté, le lien texte "Se connecter" devient **"Mon tableau de bord"** et le bouton "Commencer" devient **"Ouvrir mon espace"** — même styles, seuls le libellé et la cible changent.
- Rien de bloquant pendant `loading` : la landing s'affiche immédiatement, les CTA prennent leur libellé final dès que `user` est résolu (souvent <100ms).

## 2. Responsive mobile / tablette / desktop

Le fichier utilise déjà `useVW()` avec des breakpoints (`≤620`, `≤720`, `≤860`, `≤980`). Points à corriger observés sur la maquette actuelle :

- **Header mobile (<860)** : le nom "Tontine Digitale" peut chevaucher le bouton — réduire à `Logo` seul + bouton, cacher le texte de marque sous 420px.
- **Hero mobile (<620)** : mockup téléphone actuellement scale 0.56 ; le placer en dessous du bloc texte, centré, avec `overflow: hidden` sur le wrapper pour éviter les débordements horizontaux (les cartes flottantes du téléphone débordent aujourd'hui à droite).
- **Sections `padding` horizontal** : passer partout à un minimum `16px` mobile (aujourd'hui `20px` OK mais Security/HowItWorks utilisent `62-69px` en desktop qui reste hérité en tablet ≤980) → clamp entre 20 et 84px selon `t`/`m`.
- **Grid "Fonctionnalités" et "Comment ça marche"** : ajouter un breakpoint tablette 720–980 pour passer en 2 colonnes au lieu de 1 sur tablette portrait.
- **Footer (<860)** : la colonne marque `width: 476` casse déjà — je la passe en 100% mobile (déjà fait à l'étape précédente), mais aussi replacer la ligne "Paiements sécurisés via" en wrap propre (les 3 badges peuvent déborder).
- **Testimonials tablette** : garder 1 colonne <980 (déjà OK), mais ajuster le padding vertical à `60px` sur mobile pour homogénéité.
- **CTA final mobile** : gap 31 → 16, boutons pleine largeur (`flex: 1 1 100%`).
- **Titre Hero** : ajouter un breakpoint intermédiaire ~460 pour éviter le débordement de "Digitalisez vos tontines en toute confiance" sur petits mobiles.

Les couleurs, typographies, ombres, radius **ne changent pas** — seuls padding, gap, flexDirection, wrap, tailles de police aux breakpoints sont ajustés.

## Note sur "styles Shadcn/UI"

La landing a été implémentée en styles inline pour être fidèle à 100 % à la maquette Figma (validé à l'étape précédente). Convertir vers Shadcn/UI casserait la fidélité et impliquerait de réécrire l'ensemble avec des tokens sémantiques. Je conserve donc les styles inline actuels. Si tu veux à la place une refonte complète en Shadcn/UI (perte de fidélité pixel), dis-le et je fais une passe séparée.

## Vérification

- Ouvrir `/` en desktop (1280px), tablette (768px), mobile (390px) et comparer.
- Se connecter puis revenir sur `/` → CTA affichent "Ouvrir mon espace" / "Mon tableau de bord" et pointent vers `/dashboard`.
- Se déconnecter → CTA reviennent à "Commencer" / "Se connecter" → `/auth`.
