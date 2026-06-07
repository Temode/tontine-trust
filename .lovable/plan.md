Constat principal

L’erreur qui provoque l’écran blanc n’est plus le paquet `qrcode`. Le crash actuel est :

```text
NotFoundError: Failed to execute 'insertBefore' on 'Node'
The above error occurred in the <LoaderCircle> component
```

Ce pattern est typique quand Chrome/Google Translate ou une extension modifie le DOM que React contrôle. On voit justement l’icône/traduction Chrome active dans la capture. React essaie ensuite d’insérer le spinner `Loader2` avant un texte de bouton qui n’est plus le même nœud DOM, donc il crashe.

Le `POST /auth/v1/token ... Invalid Refresh Token` est un second problème : une ancienne session locale invalide est restée dans le navigateur. Ce n’est pas la cause directe du crash `LoaderCircle`, mais il faut le gérer proprement.

Plan de correction

1. Stabiliser les boutons de connexion
   - Dans `src/pages/Auth.tsx`, remplacer les rendus conditionnels du spinner :
     ```tsx
     {submitting && <Loader2 />}
     Se connecter
     ```
     par une structure DOM stable :
     ```tsx
     <span className="...">{submitting ? <Loader2 /> : null}</span>
     <span>Se connecter</span>
     ```
   - Même correction pour “Créer mon compte”.
   - Objectif : React ne doit plus insérer/supprimer un SVG directement avant un nœud texte traduisible.

2. Étendre ce durcissement aux autres boutons à risque
   - Rechercher les patterns `condition && <Loader2 ... />` dans les boutons.
   - Corriger les cas critiques déjà visibles : `Auth`, `JoinFlow`, `SubscriptionDialog`, `PaymentModal`, `InvitePanel`, `MyContributions`, `InviteMembers`.
   - Principe : garder un conteneur `<span>` fixe pour les icônes/spinners et envelopper le texte du bouton dans un `<span>`.

3. Protéger `/auth` avec une frontière d’erreur dédiée
   - Ajouter un `ErrorBoundary` autour de la route `/auth`, pas seulement autour des pages protégées.
   - Le fallback doit afficher un message propre Tontine Digital + bouton “Recharger la page”, au lieu d’un écran blanc.

4. Gérer les refresh tokens invalides
   - Dans `useAuth.tsx`, si `getSession()` ou l’initialisation auth rencontre `Invalid Refresh Token` / `Refresh Token Not Found`, nettoyer la session locale via `supabase.auth.signOut()` ou équivalent contrôlé, puis remettre `loading=false`.
   - Objectif : l’utilisateur revient simplement à l’écran de connexion, sans boucle ni écran vide.

5. Réduire l’impact de Google Translate sur l’app
   - Ajouter au démarrage une protection légère : définir `document.documentElement.setAttribute("translate", "no")` et `document.body.classList.add("notranslate")`.
   - Comme l’app est déjà en français, cela limite les mutations DOM automatiques de Chrome Translate.
   - Garder le code côté React plutôt que modifier `index.html` inutilement.

6. Vérification
   - Tester `/auth` : chargement, connexion en échec, connexion en succès, changement d’onglet, retour sur `/groupes`.
   - Vérifier que la console ne contient plus de crash `insertBefore` / `LoaderCircle`.
   - Vérifier que les warnings React Router restent seulement des avertissements non bloquants.