# Terminer l'écran d'appel desktop : vérification et finitions

Le code de l'écran d'appel desktop est écrit et compile. Il reste à le vérifier et à clore le chantier.

## Étapes
1. Vérifier dans les journaux que la préversion se construit sans erreur.
2. Vérification Playwright en appel simulé (mode bouchon de test), à 1280, 1024, 900 et 412 px :
   - largeur du panneau à 520 et du panneau de partage à 1120 (et règle min(1120, 100vw − 80), minimum 720, panneau de 520 sous 800 px) ;
   - avatar à 136, nom à 25, boutons à 50 espacés de 14, barre de partage à 26 du bas ;
   - `viewBox="0 0 24 24"` sur chaque icône ;
   - aucune adresse e-mail ni aucun identifiant technique dans l'identité ;
   - bande absente à deux participants ;
   - capture du téléphone à 412 px comparée à l'état précédent ;
   - partage sans caméra resté sur l'écran audio.
3. Comparer côte à côte avec `desktop.html` rendu dans le navigateur, mesure par mesure ; corriger tout écart.
4. Ajouter dans AGENTS.md la règle d'architecture : l'écran audio a un rendu téléphone figé et un rendu desktop à partir de md, et le partage d'écran sans caméra reste sur l'écran audio.
5. Rapport final : mesures relevées, écarts restants, points déjà signalés (texte principal en `--primary-foreground`, application visible derrière le voile au-dessus de 768 px, halo en dégradé repris de la maquette, double commande pour réduire l'appel).

## Limites connues
Le partage réel par un autre participant et la durée démarrant à l'arrivée d'un vrai participant demandent deux navigateurs dans une vraie salle d'appel. Si le mode bouchon ne permet pas de les simuler, je le dirai et ces deux points resteront à tester par Elhadj.
