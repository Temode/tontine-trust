# Affiliation : corriger deux défauts vus sur les captures

## Constat (vérifié en base)
- Les liens de parrainage marchent : B est filleul de A (21:08), A est filleul de votre compte (21:29). Les compteurs « Filleuls » sont justes.
- Défaut 1 — « Actifs : 1 » chez A alors que B n'a encore rien payé. Le parrainage passe en « actif » dès l'inscription. Le chiffre ne veut donc rien dire.
- Défaut 2 — chez B : « parrainé par comptea@yopmail.com ». Le compte A n'a pas de nom, alors l'adresse email du parrain s'affiche à la place. C'est une donnée personnelle montrée à un autre membre.

## Correctifs
1. « Actifs » compte seulement les filleuls qui ont payé au moins un abonnement. Le libellé devient « Abonnés actifs ». Le même calcul sert partout où ce chiffre s'affiche (page Affiliation et back-office).
2. Le nom du parrain affiche son nom complet. S'il n'en a pas (ou si le nom est une adresse email), on affiche les initiales masquées, par exemple « c•••a@yopmail.com » → plutôt « un membre Tontine Digitale ». Jamais d'adresse email en clair.
3. Test avec les comptes A et B : les chiffres et le libellé sont vérifiés à l'écran.

## Technique
- Changer get_my_referrer() pour qu'il ne renvoie jamais l'email ; repli « un membre Tontine Digitale ».
- Calculer « actifs » à partir d'un referral_earnings existant ou d'un user_subscriptions payé, dans une seule fonction partagée.
- Petit test SQL sur la règle « actif = a payé ».
