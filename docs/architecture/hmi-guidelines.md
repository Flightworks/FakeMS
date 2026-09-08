# Principes IHM de FakeMS

## Objectif

FakeMS doit aider l’utilisateur à comprendre la situation et à contrôler la simulation avec le minimum d’effort mental.

FakeMS reproduit les conventions d’interaction structurantes d’un système de mission réel. Cette structure ne doit pas servir à suggérer des capacités absentes. L’interface montre uniquement les données et les actions utiles au scénario simulé.

## Test de nécessité

Avant d’ajouter ou de conserver une information, répondre à ces questions :

1. Quelle décision ou action cette information aide-t-elle maintenant ?
2. La donnée provient-elle réellement du scénario ou d’un calcul identifié ?
3. L’action produit-elle un effet observable dans le simulateur ?
4. L’information doit-elle rester visible en permanence ?
5. Quelle est la forme la plus courte qui conserve le sens ?

Si les trois premières réponses ne sont pas claires, ne pas afficher l’élément dans l’interface principale.

## Architecture d’interaction à conserver

Trois composants font partie du modèle de système de mission simulé :

- les **PW**, ou *Permanent Widgets*, dans le bandeau supérieur ;
- les **QAK**, ou *Quick Access Keys*, dans le menu latéral ;
- les menus radiaux contextuels sur la carte et les objets.

L’assainissement ne doit pas supprimer ni remplacer cette architecture. Il doit réduire le contenu de chaque composant au strict nécessaire.

- Un PW reste visible et donne un état ou un accès direct. Son libellé et son contenu développé restent courts.
- Une QAK reste accessible en permanence et déclenche une fonction disponible en un geste.
- Un menu radial reste le moyen d’accéder aux actions contextuelles. Il ne contient pas d’action sans effet dans le simulateur.
- Un second niveau radial est justifié par plusieurs actions disponibles, pas par des entrées d’illustration.

Toute suppression d’un PW, des QAK ou du principe de menu radial demande une décision de produit explicite. Une revue IHM ordinaire ne doit pas modifier ces fondations.

## Contenu des PW, QAK et menus radiaux

### PW fermé

Afficher uniquement :

- le nom court du PW ;
- son état principal ;
- une alerte si elle demande une action.

Ne pas afficher de phrase d’aide, de conseil, de description du prototype ou de valeur déjà visible ailleurs.

### PW ouvert

Afficher uniquement :

- les commandes disponibles ;
- la valeur courante nécessaire au choix ;
- une réserve courte si une commande est temporairement indisponible.

Ne pas ajouter de texte pour donner l’apparence d’une toolbox plus complète.

### QAK

Une QAK utilise un symbole ou une abréviation stable. Elle exécute une action disponible en un geste. Elle ne contient pas de sous-titre décoratif.

### Menu radial

Un secteur radial utilise un verbe ou un nom court. Le secteur ne contient ni description, ni état fictif, ni promesse de fonction ultérieure. Le contexte de la carte ou de l’objet sélectionné fournit le sens.

### Textes à conserver

Conserver un texte lorsqu’il :

- décrit un état nécessaire au choix ;
- donne une valeur avec son unité ;
- signale une réserve réelle ;
- demande une confirmation ;
- explique comment corriger une erreur.

Supprimer un texte lorsqu’il :

- illustre seulement l’apparence d’un système de mission ;
- répète le nom du contrôle ou une valeur voisine ;
- décrit une fonction inexistante ;
- affiche une information de build dans la vue d’usage ;
- donne un conseil permanent sans rapport avec l’action courante.

## Hiérarchie de l’information

### Toujours visible

Limiter l’affichage permanent à ce qui décrit l’état immédiat :

- les PW et QAK, sous une forme compacte ;
- la position ou le mouvement utile de l’ownship ;
- la source de navigation et son état ;
- le mode de carte actif ;
- l’avertissement que FakeMS est une simulation ;
- une alerte qui demande une action immédiate.

### Visible dans son contexte

Afficher une information seulement après la sélection de l’objet concerné :

- distance et relèvement d’une cible ;
- qualité ou fraîcheur d’une piste ;
- état d’une route ou d’une trajectoire ;
- détails d’un calcul demandé.

### Disponible à la demande

Garder les réglages dans les PW ouverts à la demande ; placer les diagnostics dans une vue dédiée. Ne pas retirer les touches PW permanentes :

- réglages d’animation, d’opacité et de vibration ;
- seuils de gestes ;
- options avancées de stabilisation ;
- version, changelog et informations de développement.

### Absent

Ne pas exposer :

- une fonction non implémentée ;
- une action sans effet observable ;
- une donnée fictive présentée comme un état réel ;
- un champ `N/A` sans utilité immédiate ;
- un doublon d’une information déjà lisible dans le même contexte.

## Règles de la palette de commandes

### Rôle et capacités protégées

La palette est un accès direct aux fonctions du simulateur, pas un rapport de mission ni une démonstration de capacités. Elle complète les PW, QAK et menus radiaux ; elle ne les remplace pas.

Conserver les syntaxes utiles, les calculs, les consultations, la complétion, les favoris, le rappel d’historique et les gestes établis qui ont un effet réel. Un accès à la même action par QAK et par commande n’est pas un doublon à supprimer. Ce sont les informations répétées dans un même résultat qui constituent du bruit.

`INFO`, `AGE` et `QUALITY` répondent à des questions différentes. `STALE` est une liste de pistes, pas un alias de consultation individuelle. Alléger leur présentation sans supprimer leurs intentions.

### Affichage selon l’état de saisie

- **Vide :** champ prêt à saisir ; jusqu’à trois favoris, sinon trois commandes récentes, sinon une seule invitation courte. Historique complet et aide restent accessibles à la demande.
- **Incomplète :** montrer le paramètre attendu et ses complétions pertinentes. Ne pas ajouter simultanément une erreur, un faux résultat et une liste générique.
- **Ambiguë :** demander de choisir la cible, avec juste l’identifiant et le contexte nécessaires. Ne jamais sélectionner silencieusement la première correspondance.
- **Calcul ou consultation valide :** montrer directement le résultat sans modifier le scénario. Ne pas imposer une validation uniquement pour pouvoir lire une valeur déjà calculée.
- **Action valide :** indiquer l’effet et la cible. La saisie seule ne déclenche rien. Une validation explicite applique l’action ou ouvre sa confirmation.
- **Bloquée :** indiquer une raison utile et la correction possible. Une indisponibilité temporaire n’est pas une fonction inexistante.
- **Terminée :** afficher un retour bref lorsque l’effet n’est pas évident sur la carte. Une erreur reste lisible jusqu’à correction ou fermeture.

Une même zone porte le message principal de l’état courant. Ne pas empiler bandeau de conseil, complétion, interprétation et résultat identique.

### Résultat court, information exacte

Les seuils de trois suggestions et quatre lignes concernent le résumé initial, pas la quantité totale de données consultables. Une liste demandée (`STALE`, `LAYER LIST`, état des trajectoires) conserve toutes ses entrées dans une zone défilante. Une ambiguïté conserve tous ses candidats accessibles.

Conserver les unités, les références de cap ou de temps et les hypothèses qui changent le sens. Par exemple, un résultat CPA distingue distance minimale et délai avant CPA ; un délai utilise `min` et `s`, pas un `01:10` ambigu.

Une donnée absente n’est ni zéro ni une estimation plausible. Supprimer les champs vides non pertinents, mais conserver une mention courte lorsqu’une absence explique pourquoi le résultat demandé ne peut pas être fourni.

### Stabilité et gestes

- Ne pas déplacer la sélection ni le focus lorsque les pistes se mettent à jour.
- Recalculer un historique rappelé avec les données courantes ; ne pas rejouer une action sensible automatiquement.
- Conserver le glissement pour les lignes qui peuvent réellement être exécutées. Son effet est celui du clic, pas systématiquement `DCT`.
- Conserver le dépôt sur la carte pour les résultats qui possèdent une destination et un traitement existants. Une complétion ou une erreur ne se dépose pas sur la carte.
- Conserver les confirmations et les mêmes protections par clic, clavier, glissement et dépôt. Un geste ne doit pas les contourner.
- Retirer les conseils visibles permanents, pas les noms accessibles des boutons, le focus clavier ou les indications indispensables à une erreur.
- Adapter la hauteur au contenu et au clavier tactile, sans réduire la taille du texte ni cacher la fermeture.

### Limites de l’assainissement

Retirer un texte cosmétique ne justifie pas la suppression d’une fonction. Un changement de syntaxe, de comportement métier ou de disposition mémorisée doit être identifié séparément dans le plan. Les confirmations qui protègent une donnée locale restent en place jusqu’à remplacement testé.

### Un besoin, un résultat principal

Une commande reconnue doit produire :

- un résultat principal ;
- au maximum deux alternatives directement liées ;
- aucune suggestion provenant d’une autre intention.

Exemple : `CPA BRAVO` doit afficher le CPA. Il ne doit pas proposer en même temps `DCT BRAVO`, plusieurs plans de route et une note à sauvegarder.

### Une information affichée une seule fois

Le panneau d’interprétation et la ligne de résultat ne doivent pas répéter les mêmes valeurs.

Afficher en priorité :

1. le résultat utile ;
2. l’unité ;
3. une réserve ou une hypothèse seulement si elle change l’interprétation.

Masquer les champs sans valeur, notamment `TARGET: N/A` et `ASSUMPTIONS: NONE`.

### Pas de bruit au repos

Quand la saisie est vide, afficher au maximum :

- les trois dernières commandes utiles ; ou
- trois favoris explicites ; ou
- une courte invitation à saisir une commande.

Ne pas afficher automatiquement tous les systèmes et modes de carte.

### Pas de fonction implicite

Ne pas ajouter une proposition `SAVE` à chaque saisie reconnue. Conserver l’usage existant des notes en dehors de ces résultats ; une migration vers une syntaxe explicite telle que `NOTE` constitue une décision distincte, pas un nettoyage de texte.

La recherche floue doit aider à corriger un nom ou une commande. Elle ne doit pas mélanger calcul, navigation, route, document et système dans une seule liste.

### Action cohérente

Le libellé de l’action doit décrire son effet réel. Ne pas afficher `DIRECT TO` derrière une conversion, un calcul, une commande d’affichage ou une note.

`Entrée` et le clic exécutent la même action principale. Les gestes établis du système, notamment l’accès radial, restent disponibles. Ne pas ajouter d’autre geste caché sans gain démontré.

## Règles d’interaction

- Une consultation ou un calcul demande au plus une validation ; ne pas en ajouter pour lire un résultat déjà affiché.
- Une action locale réversible demande une seule validation.
- Une action destructive locale demande une validation puis une confirmation.
- Une fonction absente n’est pas cliquable et n’apparaît pas dans le parcours principal.
- Un contrôle désactivé indique une condition temporaire, pas une fonction inexistante.
- Un menu de second niveau existe seulement s’il contient au moins deux actions disponibles.
- Fermer un panneau ne doit pas demander une action supplémentaire.

## Règles propres au simulateur

### Capacité réelle du prototype

Une fonction peut apparaître si elle modifie ou interroge réellement :

- l’horloge et la cinématique simulées ;
- les pistes et leurs positions ;
- la carte et ses couches ;
- une route simulée ;
- une trajectoire locale ;
- un calcul déterministe fondé sur les données disponibles.

### Capacité fictive ou incomplète

Une fonction ne doit pas apparaître si elle mène à `NOT_IMPLEMENTED` ou si son résultat repose sur des valeurs arbitraires présentées comme opérationnelles.

Une démonstration expérimentale peut rester dans le code ou dans un mode développeur. Elle ne doit pas concurrencer les fonctions utilisables dans l’interface normale.

### Confirmation proportionnée

Conserver une confirmation pour :

- `SIM RESET` ;
- `SIM REPLAY` ;
- l’effacement d’une route ;
- l’effacement d’une trajectoire ;
- l’activation d’une route DCT simulée.

Une confirmation simple suffit pour ces effets locaux. Ne pas imposer une séquence `PREVIEW → AUTHORIZE → EXECUTE` lorsqu’aucune décision supplémentaire n’est prise entre les étapes.

## Présentation visuelle

- Réserver l’ambre et le rouge aux réserves et alertes réelles.
- Utiliser les majuscules pour les commandes et états courts, pas pour tous les textes.
- Éviter les animations continues, pulsations et halos décoratifs.
- Utiliser une taille de texte lisible avant de chercher à afficher plus d’informations.
- Garder un seul niveau d’accent visuel par zone.
- Préférer l’espace vide à un champ sans valeur.
- Afficher les unités avec chaque valeur numérique.

## Critères mesurables

À une largeur de 1366 × 768 :

- la palette vide contient au plus trois éléments ;
- une commande structurée affiche un résultat principal et au plus deux alternatives liées ;
- le résumé nominal tient sur quatre lignes au maximum, sans tronquer une liste demandée ni masquer une réserve nécessaire ;
- aucune valeur utile n’est répétée dans deux zones visibles ;
- aucun contrôle principal ne mène à `NOT_IMPLEMENTED` ;
- aucune action locale ne demande plus d’une confirmation ;
- les menus contextuels contiennent uniquement des actions disponibles ;
- l’interface permanente n’affiche pas un champ `N/A` accompagné d’un second message d’indisponibilité.

## Revue avant intégration

Toute modification d’interface doit être testée sur :

- 1024 × 768, format tablette ;
- 1366 × 768, format paysage ;
- clavier et pointeur ;
- palette vide, commande valide, commande ambiguë et commande indisponible ;
- mode réel et mode simulation.

Utiliser la [check-list de revue IHM](../testing/hmi-review-checklist.md) avant chaque intégration.
