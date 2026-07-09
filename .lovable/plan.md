## Nouveau design `/auth` — direction "Infrastructure calme"

Direction choisie : v2, avec **Inter uniquement** (pas d'Instrument Serif). Palette lockée : teal `#0D7377`, or `#E8AA14`, off-white `#FAFAF7`, texte `#0E1A1C`.

## Structure

- **Desktop (≥ md)** : split 5/12 – 7/12. Panneau de gauche en `bg-primary` sticky pleine hauteur avec :
  - En haut : carré or `bg-accent` 8×8 + wordmark "Tontine Digitale" blanc.
  - Au milieu : titre `text-4xl md:text-5xl font-bold tracking-tight leading-tight` en blanc — "L'infrastructure de confiance pour l'épargne collective." + sous-titre `text-white/70` — reformulé Guinée : "Rejoignez des milliers de groupes qui gèrent leur tontine avec la sécurité et la clarté d'une institution financière moderne."
  - En bas : deux KPI ("12 000+ cotisations sécurisées", "99,9% disponibilité") en `text-accent` avec label `uppercase tracking-wider text-white/50`.
- **Mobile** : panneau caché, logo compact (carré teal + wordmark) au-dessus du formulaire.
- **Section formulaire** : centré, `max-w-[400px]`, padding généreux (`p-6 sm:p-12 md:p-24`).

## Formulaire

- Header : `h1 text-4xl font-bold tracking-tight` "Bienvenue" + sous-titre `text-foreground/60` "Gérez votre tontine en toute sérénité."
- Tabs custom (pas shadcn) : deux boutons, l'actif a `border-b-2 border-primary text-primary`, l'inactif `text-foreground/40 hover:text-foreground/70`. Séparateur `border-b border-foreground/10`.
- Champs :
  - Label `text-xs font-semibold uppercase tracking-wider text-foreground/50`.
  - Input : `bg-white border border-foreground/10 rounded-md px-4 py-3 text-sm`, focus `ring-1 ring-primary border-primary`.
- Onglet **Se connecter** : Email + Mot de passe (avec lien "Oublié ?" aligné à droite du label, `text-xs text-primary`).
- Onglet **S'inscrire** : Nom complet, Téléphone (optionnel), Email, Mot de passe + hint "Au moins 8 caractères".
- CTA primaire : `w-full bg-primary text-primary-foreground py-3.5 rounded-md font-medium text-sm hover:bg-primary/90 shadow-sm active:scale-[0.98]`. Libellé : "Se connecter à mon compte" / "Créer mon compte".
- Footer : `mt-12 pt-8 border-t border-foreground/5` avec mention légale `text-[11px] text-foreground/40`.

## Tokens & implémentation

- **Aucune couleur hardcodée** : on utilise les tokens existants (`bg-primary`, `text-primary-foreground`, `border-hairline`, etc.). Les hex `#0D7377/#E8AA14/#FAFAF7/#0E1A1C` du prototype existent déjà en tokens (bleu sarcelle + or documentés dans la doctrine).
- **Police** : Inter uniquement. Vérifier que `font-sans` (Tailwind) → Inter dans la config actuelle. Si pas encore chargée, `bun add @fontsource/inter` + `import "@fontsource/inter/400.css"` (+500/+600) dans `src/main.tsx`, puis `fontFamily.sans = ["Inter", ...]` dans `tailwind.config.ts`. Le `font-display` reste (déjà bold tracking-tight) mais mappé sur Inter aussi pour cette page.
- **Composant Logo** existant conservé côté mobile ; côté panneau desktop on affiche l'ancre custom (carré or + wordmark blanc) pour matcher le proto.

## Comportement

- Toute la logique existante (Zod, `useAuth.signIn/signUp`, redirection par rôle, envoi vers `/auth/verifier-email` après signup) est **conservée à l'identique**. Seule la présentation change.
- États : loading = squelette (déjà en place dans le shell), soumission = CTA disable + spinner interne, erreurs via `toast`.
- Lien "Mot de passe oublié ?" → `/auth/mot-de-passe-oublie` conservé.
- Skeleton pendant `loading || rolesLoading` conservé.

## Fichiers modifiés

- `src/pages/Auth.tsx` — refonte complète du JSX (form logic identique).
- `src/main.tsx` + `tailwind.config.ts` — ajout Inter via `@fontsource/inter` si nécessaire.
- Aucune autre page touchée (les autres écrans auth garderont leur design actuel — cohérent avec la même palette).

## Ce qu'on ne fait pas

- Pas de social login.
- Pas de nouvelles routes.
- Pas de modif backend / Supabase / edge functions.
- Pas de changement des libellés fonctionnels (validation Zod, mapAuthError inchangés).
