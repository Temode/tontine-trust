# Réparer la compilation Android (erreur « proguard-android.txt »)

## Diagnostic
- Le rapport de plantage du 17/10 (MainActivity introuvable) est ancien : il a déjà été corrigé.
- L'erreur actuelle (20/10, 12:17) est différente : la compilation s'arrête avant même d'installer l'app. La version récente de l'outil Android (Gradle) refuse l'ancienne ligne `getDefaultProguardFile('proguard-android.txt')`.
- Le dossier `android` n'existe que sur votre ordinateur : la correction se fait en une ligne dans Android Studio.

## Étapes (dans Android Studio)
1. Ouvrir l'onglet **build.gradle (:app)** (déjà ouvert sur votre capture).
2. Chercher la ligne (vers la ligne 20-22) :
   `proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'`
3. La remplacer par :
   `proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'`
4. Enregistrer (Ctrl+S), cliquer **Sync Now** en haut.
5. Appuyer sur ▶ (Run 'app').

## Si une nouvelle erreur apparaît
- Ne pas accepter « New Minor Gradle Version Available » ni l'assistant de mise à jour pour l'instant.
- Envoyer une capture du nouveau message ; les 7 avertissements « deprecated » sont sans gravité.

## Côté projet
- Ajouter cette correction dans le guide de publication mobile pour que l'étape soit documentée lors des prochaines régénérations du dossier android.
