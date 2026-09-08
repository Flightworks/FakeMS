# Plan d’assainissement de l’interface FakeMS

> **Statut :** tranches IHM, menu radial et palette exécutées le 8 septembre 2026. La qualification globale reste à terminer. Deux décisions de périmètre restent ouvertes : la présentation de `PLAN` et de son modèle carburant, ainsi que l’exposition utilisateur de `AIS/EOTS`.
>
> **Périmètre :** vue principale, palette de commandes, contrôles de simulation, menus contextuels et panneaux de résultat.
>
> **Références :** [principes IHM](../architecture/hmi-guidelines.md) · [check-list de revue](../testing/hmi-review-checklist.md)

**Architecture :** conserver PW, QAK, menu radial et palette. Réutiliser le parseur, le registre et les traitements existants ; séparer leur présentation sans ajouter de moteur de commande ni de dépendance.

**Technologies :** React, TypeScript, Vite, Vitest et Playwright.

> **Pour Hermes :** charger `subagent-driven-development` lors d’une future exécution déléguée. Chaque changement suit test rouge, modification minimale, test vert et revue du diff. Ne pas confondre validation de ce plan et autorisation de déployer.

## État d’exécution

Commits réalisés sur la branche de développement :

- `ed65c44` — conservation du menu radial et retrait de ses secteurs sans effet ;
- `f780fa2` — réduction des textes des PW, QAK et panneaux ;
- `cf1ab2e` — réduction de la palette et suppression de ses suggestions hors intention ;
- `566bb88` — tests E2E de protection de l’architecture PW/QAK/radiale.

Les guides et l’inventaire textuel restent à committer après la qualification globale.

### Blocages de périmètre

- `PLAN` est une fonction existante avec des tests, un solveur et un effet de route simulé. Ses contraintes carburant utilisent des valeurs codées en dur. Retirer ces valeurs ou supprimer la fonction changerait son comportement métier.
- `AIS` et `EOTS` ont des implémentations de domaine et des tests de collecte de capteurs. Leur effet n’est pas actuellement visible dans la carte comme celui de `RADAR` et `ADSB`, mais leur suppression modifierait le modèle de simulation.

Ces deux sujets ne doivent pas être résolus par une suppression silencieuse. La qualification finale peut continuer sur les tranches non bloquées ; la suite du plan s’arrête avant toute modification de ces modèles tant qu’une décision n’est pas donnée.

## Limites de validation

- La priorité est le contenu affiché, pas la suppression de fonctions ou la refonte des gestes.
- Un libellé mission n’est pas fictif par nature. Son état doit refléter exactement l’effet simulé disponible.
- Toute suppression de fonction utile, modification de syntaxe ou réaffectation des secteurs radiaux sort du nettoyage textuel et nécessite une décision explicite avant exécution.
- Les tâches de retrait fonctionnel ci-dessous s’appliquent seulement aux ajouts dont l’absence d’effet utile est confirmée. Si une fonction possède un effet utile partiel, conserver cet effet et retirer la présentation trompeuse.
- Préserver la branche `dev/mission-simulation-foundation`, ne pas modifier `main`, ne pas déployer. Préserver les artefacts préexistants et ne pas introduire de dépendance.
- Le nombre de lignes ou de suggestions est un budget de présentation initiale, jamais un motif pour cacher une liste demandée ou un avertissement nécessaire.

## But

Réduire la charge visuelle et cognitive sans retirer les capacités réellement utiles du simulateur.

Le menu radial, les PW du bandeau supérieur et les QAK du menu latéral constituent l’architecture d’interaction du système de mission simulé. Le plan conserve ces trois fondations. Il assainit leur contenu sans les remplacer par une interface générique.

Le résultat attendu est une interface calme dans laquelle :

- la carte reste dominante ;
- une commande produit un résultat court et pertinent ;
- aucune action visible n’aboutit à une fonction absente ;
- les réglages de prototype ne concurrencent pas l’usage normal ;
- toute donnée présentée comme opérationnelle possède une source réelle ou un calcul déterministe.

## Constats vérifiés le 7 septembre 2026

### Palette

À 1366 × 768 :

- la palette vide affiche six commandes génériques ;
- chaque ligne possède un fond d’action `DIRECT TO`, y compris les commandes système et de carte ;
- `CPA BRAVO` produit 32 lignes de texte visibles ;
- cette commande affiche 13 lignes d’interprétation, puis répète le résultat dans la liste ;
- elle ajoute aussi `DCT BRAVO`, trois plans de route et `SAVE: CPA BRAVO` ;
- les champs génériques `TYPE`, `TARGET`, `ASSUMPTIONS`, `SOURCE`, `EFFECT` et `STATUS` sont affichés même lorsqu’ils n’aident pas la lecture ;
- la proposition `SAVE` est ajoutée à toute saisie non vide ;
- la recherche floue mélange calcul, entité, route, fichier, note et système.

### Menus et toolboxes

- le menu radial contient 28 sous-actions marquées `NOT_IMPLEMENTED` pour une seule sous-action réellement disponible, `VECTOR` ;
- un parcours radial indisponible est tout de même proposé, prévisualisé et autorisé avant d’annoncer son absence ;
- `STABLN CFG` expose sept réglages de prototype dans la barre principale ;
- `HMI CFG` expose douze réglages de conception répartis en trois sous-menus ;
- le panneau `NAV` mélange source de navigation, contrôle de simulation et réglages avancés de mouvement ;
- `SideMenu.tsx` contient d’autres actions indisponibles, mais n’est plus monté : il s’agit de code mort.

Ces constats portent sur le contenu des menus, pas sur leur présence. Le menu radial, les PW et les QAK doivent rester accessibles dans l’état cible.

### Données et états

- `AIS` et `EOTS` ont un effet dans le domaine de collecte des capteurs, mais leur état n’est pas relié à un affichage carte équivalent à `RADAR` et `ADSB` ;
- `RADAR` et `ADSB` agissent comme filtres d’affichage, pas comme capteurs simulés complets ;
- ces quatre systèmes ne doivent pas être présentés comme une couche carte unique sans décision sur leur portée ;
- le planificateur `PLAN` calcule des marges à partir de valeurs codées en dur : 100 unités disponibles, 20 de réserve et 1 unité par NM ;
- ces valeurs sont ensuite présentées comme contraintes de carburant dans un comparateur de routes ;
- le panneau ownship affiche simultanément `HGT N/A` puis `UNAVAILABLE · UNAVAILABLE` ;
- le bandeau de simulation expose le numéro de build dans la vue d’usage.

## Décisions de produit proposées

### Conserver

Ces fonctions ont un effet local clair ou un résultat déterministe :

- sélection et centrage d’une entité ;
- orientation nord/cap et recentrage de la carte ;
- calculs tactiques fondés sur les données disponibles ;
- commandes explicites de simulation : état, pause, reprise, vitesse, reset et replay ;
- route DCT simulée avec une confirmation ;
- affichage, masquage et effacement d’une route ou d’une trajectoire ;
- couches, déclutter, grille et zones, accessibles uniquement à la demande ;
- timers, bullseye et désignations lorsqu’ils produisent un résultat observable ;
- ouverture explicite d’un document.

### Simplifier

- conserver `INFO`, `AGE`, `QUALITY` et `STALE` comme intentions distinctes ; mutualiser leur présentation sans supprimer leurs syntaxes ;
- limiter la palette à un résultat principal et deux alternatives liées ;
- remplacer les longs panneaux d’interprétation par un résultat et, si nécessaire, une réserve ;
- remplacer les cycles `PREVIEW → AUTHORIZE → EXECUTE` par une seule confirmation pour les effets locaux sensibles ;
- ramener le panneau de simulation aux contrôles réellement nécessaires au scénario courant ;
- masquer les champs ownship sans valeur plutôt que d’expliquer deux fois leur indisponibilité.

### Déplacer hors de l’interface normale

- explications détaillées sur l’animation, l’opacité, la vibration et les gestes ;
- valeurs de diagnostic qui n’aident pas à choisir un réglage ;
- explications internes sur la mécanique de stabilisation ;
- version, changelog et informations de build ;
- commandes rares qui restent valides, mais ne doivent pas être suggérées sans saisie explicite.

Les réglages qui produisent un effet démontré restent accessibles depuis leur PW. Les détails techniques peuvent rester dans une page de diagnostic ou un mode développeur non activé par défaut.

### Retirer

- toutes les entrées visibles qui mènent à `NOT_IMPLEMENTED` ;
- les secteurs radiaux sans effet, mais pas le menu radial lui-même ;
- `SideMenu.tsx` s’il est confirmé comme composant mort, sans toucher au composant QAK réellement monté ;
- les propositions automatiques de systèmes sans rapport avec la saisie ; ne retirer une commande explicite qu’après vérification de ses effets ;
- la proposition automatique `SAVE` après une commande reconnue ; ne pas supprimer les notes ni inventer une syntaxe `NOTE` dans le lot de nettoyage textuel ;
- les marges et justifications carburant arbitraires de `PLAN THREAT/COVERAGE/ENDURANCE` ; préserver un effet de route utile s’il existe, et soumettre séparément le retrait de toute la fonction ;
- les textes décoratifs, conseils permanents, pulsations et libellés génériques d’action.

## État cible

### Vue principale

Toujours visible :

- badge compact `SIMULATION` ;
- heure ;
- état de navigation ;
- PW compacts dans le bandeau supérieur ;
- QAK dans le menu latéral ;
- ownship avec trois données valides au maximum ;
- accès visible à la palette pour le tactile ;
- orientation/recentrage de la carte.

À la demande :

- détails de piste ;
- couches, grille, zones et trajectoires ;
- réglages avancés de simulation ;
- diagnostics et informations de version.

### Palette vide

Afficher soit :

- trois commandes récentes ;
- trois favoris ;
- une phrase courte avec deux exemples.

Ne pas afficher une liste de systèmes par défaut.

### Palette avec commande structurée

Gabarit cible pour `CPA BRAVO` (champs remplis par le calcul, pas de valeurs de démonstration en production) :

```text
CPA BRAVO
Distance minimale : <distance> NM
Délai avant CPA : <minutes> min <secondes> s
```

Ajouter une réserve uniquement si une piste est périmée ou si une donnée nécessaire manque.

### Action sensible

Exemple cible pour `SIM RESET` :

```text
Réinitialiser la simulation ?
[Annuler] [Réinitialiser]
```

Aucun écran intermédiaire `PREVIEW`, `AUTHORIZE` ou `EXECUTE`.

## Ordre d’exécution

L’ordre vise à enlever d’abord les impasses, puis à réduire la densité, sans changer les calculs métier.

---

## Phase 1 — Fixer les critères et protéger le comportement utile

### Tâche 1.1 — Ajouter les tests de densité et de pertinence

**Fichiers :**

- créer `tests/e2e/hmi-density.spec.ts` ;
- modifier `tests/components/CommandPalette.test.tsx` ;
- modifier `tests/components/CommandPaletteTactical.test.tsx` ;
- modifier `tests/utils/CommandRegistry.test.ts`.

**Travail :**

1. Écrire des tests actuellement rouges pour la palette vide : trois éléments maximum, aucun système générique et aucun fond `DIRECT TO` non pertinent.
2. Écrire un test pour `CPA BRAVO` : un résultat principal, deux alternatives liées maximum, aucun `DCT`, `PLAN` ou `SAVE`.
3. Écrire un test qui refuse les champs `TARGET: N/A`, `ASSUMPTIONS: NONE` et `STATUS: SIMULATED` pour un calcul.
4. Écrire un test pour une commande inconnue : message court et absence de mélange inter-domaines.
5. Mesurer les lignes visibles avec les mêmes vues 1024 × 768 et 1366 × 768.

**Validation ciblée :**

```bash
npm test -- --run \
  tests/components/CommandPalette.test.tsx \
  tests/components/CommandPaletteTactical.test.tsx \
  tests/utils/CommandRegistry.test.ts
CI=1 npx playwright test tests/e2e/hmi-density.spec.ts --workers=1 --retries=0
```

### Tâche 1.2 — Protéger les capacités à conserver

**Fichiers :**

- modifier les tests E2E de calcul, simulation, route, couches, grille, zones et trajectoires ;
- ne pas modifier encore le code de production.

**Travail :**

1. Vérifier qu’une consultation ou un calcul s’achève en une validation.
2. Vérifier que `DCT`, `SIM RESET`, `SIM REPLAY`, `ROUTE CLEAR` et `TRAIL CLEAR` gardent une confirmation.
3. Vérifier qu’un contrôle de couche reste directement observable sur la carte.
4. Ajouter des assertions centrées sur le résultat utile plutôt que sur les anciens textes décoratifs.

**Critère de sortie :** les tests distinguent les capacités utiles de leur présentation actuelle.

### Tâche 1.3 — Inventorier les textes visibles

**Fichiers :**

- créer `docs/reviews/hmi-text-inventory.md` ;
- inspecter `components/TopSystemBar.tsx` ;
- inspecter `components/LeftSidebar.tsx` ;
- inspecter `components/PieMenu.tsx` ;
- inspecter `components/CommandPalette.tsx` ;
- inspecter `components/CommandInterpretationPanel.tsx` ;
- inspecter `components/InfoPanels.tsx` et les panneaux d’action.

**Travail :**

1. Relever chaque texte visible dans les PW fermés et ouverts, les QAK, les menus radiaux, la palette et les panneaux.
2. Classer chaque texte en `CONSERVER`, `RACCOURCIR` ou `SUPPRIMER`.
3. Associer chaque texte conservé à un état, une action, une valeur, une réserve, une confirmation ou une correction d’erreur.
4. Classer comme cosmétique tout texte sans lien avec l’une de ces fonctions.
5. Vérifier que les abréviations mission nécessaires restent stables.
6. Valider l’inventaire avant toute modification visuelle globale.

**Critère de sortie :** aucun texte n’est conservé uniquement pour illustrer l’apparence d’un système de mission.

---

## Phase 2 — Assainir les interactions mission et retirer les capacités fictives

### Tâche 2.1 — Assainir le contenu du menu radial

**Fichiers :**

- modifier `components/MapDisplay.tsx` ;
- modifier `components/PieMenu.tsx` ;
- modifier `App.tsx` ;
- modifier `tests/components/MapDisplay.test.tsx` ;
- modifier `tests/e2e/pie-menu.spec.ts`.

**Travail :**

1. Conserver l’ouverture, la géométrie et la navigation du menu radial.
2. Supprimer ou remplacer les 28 appels à `unavailableOption`.
3. Relier les secteurs uniquement à des fonctions existantes et testées, par exemple `INFO`, `FOCUS`, `DCT` ou `VECTOR` selon le contexte.
4. Ne pas inventer d’actions pour remplir tous les secteurs.
5. Conserver l’appui long et les gestes radiaux établis.
6. Vérifier qu’aucun secteur ne crée un parcours sans issue.

**Critère de sortie :** le menu radial reste accessible et ne contient aucune action `NOT_IMPLEMENTED`.

### Tâche 2.2 — Supprimer le code mort et le cycle de mission sans usage

**Fichiers :**

- supprimer `components/SideMenu.tsx` après confirmation de l’absence d’import de production, sans modifier la QAK `LeftSidebar.tsx` ;
- modifier ou supprimer `components/MissionActionStatusPanel.tsx` ;
- modifier `application/missionActionReducer.ts` et `domain/missionActions.ts` selon les usages restants ;
- modifier `tests/application/missionActionReducer.test.ts` ;
- modifier `tests/components/MissionActionStatusPanel.test.tsx` ;
- modifier `App.tsx`.

**Travail :**

1. Rechercher tous les producteurs de `MissionActionRequest`.
2. Après assainissement du menu radial, supprimer le cycle générique s’il ne sert plus à une action disponible.
3. Ne pas conserver un panneau générique uniquement pour ses tests.
4. Vérifier l’absence de `NOT_IMPLEMENTED` dans toute interaction visible.
5. Vérifier que la QAK latérale reste montée et fonctionnelle.
6. Protéger les usages existants de `MissionActionStatusPanel` et du réducteur pour `ROUTE CLEAR` et `TRAIL CLEAR`. Ne supprimer ces composants qu’après remplacement testé de ces confirmations, en phase 5.

**Critère de sortie :** la chaîne `NOT_IMPLEMENTED` ne peut plus être obtenue par l’utilisateur.

### Tâche 2.3 — Retirer les données carburant non justifiées

**Fichiers :**

- modifier `App.tsx` ;
- modifier `utils/CommandRegistry.ts` ;
- inspecter `components/ProposalComparisonPanel.tsx` et `components/JustificationPanel.tsx` ;
- inspecter `simulation/simpleRouteSolver.ts` ;
- inspecter `domain/intent.ts`, `domain/constraints.ts` et `domain/proposals.ts` ;
- conserver `tests/simulation/simpleRouteSolver.test.ts` pour protéger les effets utiles ;
- modifier les tests de palette et de route.

**Travail :**

1. Retirer les suggestions `PLAN` des calculs sans rapport avec la planification.
2. Identifier les valeurs arbitraires et les décisions de faisabilité qui en dépendent. Retirer leur présentation trompeuse sans rendre silencieusement une route interdite exécutable.
3. Conserver `DCT` et le résumé de la route active, qui reposent sur des positions réelles du scénario.
4. Ne pas remplacer les valeurs fictives par d’autres valeurs inventées.
5. Si une correction exige de changer les contraintes, les algorithmes ou de retirer `PLAN`, présenter ce changement séparément et attendre une décision. Aucun fichier du solveur n’est supprimé automatiquement par ce plan IHM.

**Critère de sortie :** aucune marge carburant n’est présentée sans donnée de mission fournie.

### Tâche 2.4 — Clarifier la portée des commandes systèmes

**Fichiers :**

- modifier `types.ts` ;
- modifier `App.tsx` ;
- modifier `components/CommandPalette.tsx` ;
- modifier `components/MapDisplay.tsx` ;
- modifier `components/TopSystemBar.tsx` ;
- modifier `utils/CommandRegistry.ts` ;
- modifier les tests de couches, de carte et de palette.

**Travail :**

1. Reconfirmer les effets de `AIS` et `EOTS` avant de retirer une entrée sans effet ; ne pas supprimer un PW ou une QAK au passage.
2. Conserver les libellés mission `RADAR` et `ADSB` lorsque leur comportement de filtre est utile. Indiquer leur portée simulée dans l’aide contextuelle sans inventer de télémétrie capteur.
3. Retirer ces suggestions lorsqu’elles sont sans rapport avec la commande saisie.
4. Vérifier que la palette, le PW et la QAK d’une même action utilisent le même état existant.
5. Ne pas migrer `SystemStatus` vers `TacticalLayerState` dans un nettoyage de textes. Documenter séparément une divergence fonctionnelle si elle est constatée.

**Critère de sortie :** aucun statut inventé ; effets et libellés utiles préservés, aucune suggestion système parasite.

---

## Phase 3 — Rendre la palette concise et déterministe

### Tâche 3.1 — Séparer reconnaissance et présentation

**Fichiers :**

- créer `domain/commandPresentation.ts` ;
- créer `tests/domain/commandPresentation.test.ts` ;
- modifier `utils/CommandRegistry.ts` ;
- modifier `components/CommandPalette.tsx`.

**Travail :**

1. Introduire un modèle de présentation minimal : résultat principal, unité, réserve facultative et actions liées.
2. Garder les objets métier détaillés hors du composant visuel.
3. Limiter les suggestions initiales à trois éléments ; conserver les listes demandées et tous les candidats ambigus accessibles par défilement.
4. N’afficher une source ou une hypothèse que si elle est non évidente ou dégradée.
5. Supprimer les libellés génériques qui ne correspondent pas à l’action.

**Critère de sortie :** le composant n’a plus besoin de reconstruire un rapport complet à partir de chaque type de commande.

### Tâche 3.2 — Corriger la stratégie de recherche

**Fichiers :**

- modifier `utils/CommandRegistry.ts` ;
- modifier `tests/utils/CommandRegistry.test.ts`.

**Travail :**

1. Si le parseur reconnaît une commande structurée, retourner uniquement son résultat et ses alternatives du même domaine.
2. Utiliser la recherche floue uniquement pour corriger un mot ou un identifiant dans le domaine demandé.
3. Réserver la recherche de documents au préfixe `OPEN`.
4. Réserver la sélection d’entité seule à une petite liste `INFO`, `FOCUS` et `DCT`.
5. Ne plus exécuter les stratégies système, fichier, entité et note en parallèle pour chaque saisie.

**Critère de sortie :** `CPA BRAVO` ne contient plus aucun résultat de route, document, système ou note.

### Tâche 3.3 — Retirer la suggestion de note parasite

**Fichiers :**

- conserver `domain/commandParser.ts` et les syntaxes existantes dans ce lot ;
- modifier `utils/CommandRegistry.ts` ;
- modifier les tests du parseur et du registre ;
- modifier `docs/05-scratchpad-guide.md`.

**Travail :**

1. Identifier les usages existants des notes et protéger leur comportement par un test.
2. Ne jamais proposer `SAVE` sur une commande déjà reconnue.
3. Conserver les notes hors du résultat d’une commande reconnue. Toute migration vers `NOTE` fait l’objet d’une décision distincte ; ne pas l’implémenter automatiquement.
4. Documenter honnêtement la portée locale et non persistante.

**Critère de sortie :** absence de `SAVE` parasite ; comportement de note existant préservé hors des commandes reconnues.

### Tâche 3.4 — Réduire le panneau d’interprétation

**Fichiers :**

- modifier `components/CommandInterpretationPanel.tsx` ;
- modifier `tests/components/CommandInterpretationPanel.test.tsx` ;
- modifier les tests E2E tactiques.

**Travail :**

1. Afficher deux lignes pour un résultat nominal : nom et valeur.
2. Autoriser au maximum deux lignes supplémentaires : réserve et source dégradée.
3. Omettre les valeurs absentes.
4. Supprimer `STATUS: SIMULATED` pour les calculs ; leur nature locale est indiquée une seule fois au niveau de la palette ou de la documentation.
5. Supprimer les répétitions entre ce panneau et la ligne de résultat.

**Critère de sortie :** résumé nominal de quatre lignes maximum ; listes et détails demandés complets, unités et réserves nécessaires conservées.

### Tâche 3.5 — Simplifier la mécanique visuelle de la palette

**Fichiers :**

- modifier `components/CommandPalette.tsx` ;
- modifier les tests clavier et tactiles ;
- modifier `docs/05-scratchpad-guide.md`.

**Travail :**

1. Garder clic et `Entrée` comme interactions principales.
2. Conserver le glissement lorsqu’il exécute réellement la commande principale, même sans action secondaire. Conserver le dépôt sur la carte pour les résultats pris en charge ; ne pas rendre les erreurs ou complétions exécutables.
3. Supprimer le conseil permanent du pied de palette.
4. Supprimer les pulsations décoratives.
5. Remplacer le titre marketing par un titre court ou aucun titre si le champ suffit.
6. Conserver les raccourcis clavier, noms accessibles et focus. Déplacer seulement les explications longues dans l’aide ; une indication courte de touche utile peut rester.

**Critère de sortie :** aucune action cachée n’est suggérée visuellement derrière une ligne qui ne la supporte pas.

### Tâche 3.6 — Tester les états de la palette sans empiler les panneaux

**Fichiers :** modifier `components/CommandPalette.tsx`, `components/CommandInterpretationPanel.tsx`, `tests/components/CommandPalette.test.tsx` et `tests/components/CommandPaletteTactical.test.tsx` ; compléter `tests/e2e/hmi-density.spec.ts` prévu en tâche 1.1.

**Travail, par cas test :**

1. Écrire une assertion rouge pour un état : vide, incomplet, ambigu, résultat valide, action, indisponibilité temporaire ou retour d’exécution.
2. Lancer `npm test -- --run tests/components/CommandPalette.test.tsx tests/components/CommandPaletteTactical.test.tsx` et vérifier l’échec attendu, pas une erreur d’environnement.
3. Afficher le contenu de cet état dans la zone principale sans doublon ; réutiliser les objets de calcul et de résolution existants.
4. Relancer les tests ciblés jusqu’au vert, puis examiner le diff avant de passer à l’état suivant.

**Assertions obligatoires :**

- `CPA BRAVO` : une distance minimale et un délai avec unités ; aucune note ou route suggérée ; réserve pertinente conservée.
- Commande incomplète : paramètre attendu et complétions, sans exécution.
- Entité ambiguë : tous les candidats restent accessibles ; aucune cible choisie automatiquement.
- `STALE` ou `LAYER LIST` avec plus de trois entrées : toutes les entrées sont consultables, sans troncature silencieuse.
- Donnée manquante : aucun zéro de substitution ; raison lisible, aucune validation trompeuse.
- Consultation en cours de frappe : aucun changement du scénario ni ajout à l’historique à chaque frappe.

### Tâche 3.7 — Protéger gestes, historique et stabilité

**Fichiers :** modifier `tests/e2e/command-palette-keyboard.spec.ts`, `tests/e2e/command-palette-execution.spec.ts`, `tests/e2e/command-palette.spec.ts` et les composants directement responsables uniquement après test rouge.

**Travail :** écrire puis vérifier séparément les tests suivants avant chaque modification minimale :

- Ouvrir depuis la QAK et les raccourcis établis ; fermer puis retrouver le focus utile.
- Rappeler une commande sensible depuis l’historique sans l’exécuter ; confirmer uniquement après nouvelle validation.
- Vérifier l’équivalence clic, Entrée, glissement et dépôt compatible ; aucune double exécution ni contournement de confirmation.
- Faire évoluer une piste pendant la sélection d’un résultat ; conserver cible, sélection et focus stables.
- Vérifier le défilement, la fermeture et le résultat principal avec clavier tactile à 1024 × 768 et 1366 × 768.
- Retirer les textes visuels cosmétiques tout en conservant les noms accessibles des contrôles.

**Validation ciblée après chaque correction :**

```bash
CI=1 npx playwright test tests/e2e/command-palette-keyboard.spec.ts tests/e2e/command-palette-execution.spec.ts tests/e2e/command-palette.spec.ts --workers=1 --retries=0
```

**Critère de sortie :** le nettoyage ne réduit ni les moyens d’accès ni les protections des actions. Les suites complètes restent exigées en phase 6.

---

## Phase 4 — Alléger la vue tout en conservant les PW et les QAK

### Tâche 4.1 — Assainir le PW `HMI CFG`

**Fichiers :**

- modifier `components/TopSystemBar.tsx` ;
- modifier `App.tsx` ;
- modifier `types.ts` uniquement si un réglage sans effet est supprimé ;
- modifier `tests/components/TopSystemBar.test.tsx`.

**Travail :**

1. Conserver la touche PW `HMI CFG` dans le bandeau supérieur.
2. Vérifier que chaque réglage `HUD`, `GEST` et `VIS` produit un effet observable.
3. Conserver les réglages utiles et supprimer uniquement ceux qui n’ont aucun effet.
4. Réduire les libellés, descriptions, statuts et décorations de la toolbox.
5. Afficher l’état courant dans le PW sans expliquer en permanence la mécanique interne.
6. Conserver `PrototypeSettings` tant qu’il représente des réglages réellement disponibles.

**Critère de sortie :** le PW `HMI CFG` reste accessible ; son contenu ne contient ni réglage sans effet ni texte d’illustration.

### Tâche 4.2 — Assainir le PW `STABLN CFG`

**Fichiers :**

- modifier `components/TopSystemBar.tsx` ;
- modifier `App.tsx` ;
- modifier `tests/components/TopSystemBar.test.tsx` ;
- modifier les tests de stabilisation.

**Travail :**

1. Conserver la touche PW `STABLN CFG` et son accès à la configuration.
2. Vérifier l’effet réel de chaque option de recadrage, gel du cap et retour de stabilisation.
3. Retirer uniquement une option sans effet ou un texte explicatif redondant.
4. Afficher le mode courant avec un libellé court.
5. Conserver les QAK `N-UP`, `H-UP`, centrage et `GND` lorsqu’elles donnent l’accès rapide attendu.
6. Définir clairement les rôles : la QAK déclenche l’action rapide ; le PW indique l’état et ouvre la configuration.

**Critère de sortie :** le PW et les QAK de stabilisation restent présents sans doublon textuel ni option cosmétique.

### Tâche 4.3 — Recentrer le PW `NAV` sur la simulation utile

**Fichiers :**

- modifier `components/TopSystemBar.tsx` ;
- modifier `App.tsx` ;
- modifier les tests de simulation et navigation.

**Travail :**

1. Conserver le PW `NAV` avec l’état `REAL` ou `SIM` directement lisible.
2. Conserver pause/reprise, cap, vitesse, reset et replay.
3. Vérifier l’utilité des virages continus, du verrouillage et du taux de virage ; garder chaque commande qui soutient un scénario simulé.
4. Retirer les phrases d’aide et valeurs répétées qui n’apportent aucune décision.
5. Séparer visuellement l’état de géolocalisation des commandes de cinématique, sans supprimer leur PW commun.

**Critère de sortie :** le PW `NAV` reste permanent ; son état est lisible fermé et sa toolbox ne contient que des contrôles effectifs.

### Tâche 4.4 — Réduire les panneaux et le contenu des QAK

**Fichiers :**

- modifier `components/InfoPanels.tsx` ;
- modifier `components/SimulationBanner.tsx` ;
- modifier `components/LeftSidebar.tsx` ;
- modifier leurs tests.

**Travail :**

1. Conserver `LeftSidebar.tsx` comme structure QAK permanente.
2. Conserver la géométrie et l’accès en un geste de chaque QAK utile.
3. Retirer les textes d’illustration, sous-titres et états répétés autour des QAK.
4. Limiter l’ownship aux trois valeurs valides les plus utiles.
5. Supprimer les doubles mentions d’indisponibilité.
6. Masquer les coordonnées précises jusqu’à une demande ou une sélection.
7. Garder le badge de simulation et retirer le build de la vue d’usage.
8. Déplacer version et changelog vers une page `À propos` si ces éléments ne servent pas une QAK opérationnelle.
9. Conserver une QAK d’accès tactile à la palette.

**Critère de sortie :** la structure QAK reste présente et la carte redevient l’élément dominant avant toute interaction.

### Tâche 4.5 — Adopter un déclutter calme par défaut

**Fichiers :**

- modifier `domain/declutter.ts` ;
- modifier `App.tsx` si nécessaire ;
- modifier les tests de déclutter et les captures E2E.

**Travail :**

1. Évaluer `NORMAL` comme valeur par défaut à la place de `FULL`.
2. Afficher les détails d’une piste sélectionnée même si les autres libellés sont masqués.
3. Conserver `FULL` comme commande explicite.
4. Vérifier que les alertes et la route active restent visibles.

**Critère de sortie :** les libellés secondaires ne sont pas tous visibles au repos.

---

## Phase 5 — Simplifier les confirmations

### Tâche 5.1 — Créer une confirmation locale unique

**Fichiers :**

- créer ou simplifier `components/ConfirmationPanel.tsx` ;
- modifier `App.tsx` ;
- modifier `components/ActionStatusPanel.tsx` ;
- modifier les tests route, trail, reset, replay et DCT.

**Travail :**

1. Utiliser une structure commune : question, conséquence locale, `Annuler`, action explicite.
2. Exécuter immédiatement après confirmation.
3. Afficher un retour bref de succès ou d’échec, sans journal permanent.
4. Conserver l’historique métier en mémoire seulement lorsqu’il sert une fonction consultable.

**Critère de sortie :** aucune action locale ne requiert trois étapes successives.

### Tâche 5.2 — Vérifier tous les parcours principaux

**Fichiers :**

- créer ou compléter `tests/e2e/hmi-action-budget.spec.ts` ;
- modifier les tests E2E concernés.

**Scénarios :**

- calcul `CPA BRAVO` ;
- `INFO BRAVO` ;
- `DCT BRAVO` ;
- `SIM RESET` ;
- `SIM REPLAY` ;
- `ROUTE CLEAR` ;
- `TRAIL CLEAR BRAVO` ;
- sélection d’une piste ;
- modification d’une couche.

**Assertions :**

- calcul/consultation : une validation ;
- action réversible : une validation ;
- action destructive ou route DCT : une validation et une confirmation ;
- zéro état `NOT_IMPLEMENTED` ;
- zéro étape sans nouvelle information.

---

## Phase 6 — Qualification et documentation

### Tâche 6.1 — Revue visuelle mesurée

**Travail :**

1. Capturer vue principale, palette vide et `CPA BRAVO` à 1024 × 768 et 1366 × 768.
2. Compter les contrôles, lignes et résultats visibles.
3. Comparer aux critères du guide IHM.
4. Vérifier le clavier, le pointeur et le tactile.
5. Corriger toute animation, couleur ou doublon qui attire l’attention sans nécessité.

### Tâche 6.2 — Mettre à jour la documentation utilisateur

**Fichiers :**

- modifier `docs/05-scratchpad-guide.md` ;
- modifier `docs/03-interface-guide.md` ;
- modifier `docs/README.md` ;
- modifier `README.md` uniquement si les fonctions retirées y sont annoncées.

**Travail :**

1. Retirer les commandes supprimées.
2. Montrer d’abord les cinq usages les plus fréquents.
3. Décrire la confirmation unique.
4. Indiquer clairement ce que le simulateur ne fait pas.
5. Ne pas documenter les réglages développeur comme des fonctions utilisateur.

### Tâche 6.3 — Gates finales

Exécuter :

```bash
npm run typecheck
npm run check
npm run build
CI=1 npx playwright test --workers=1 --retries=0
npm audit --omit=dev --audit-level=high --offline
git diff --check
```

Si Playwright dépasse la limite de l’outil, lister les scénarios puis les exécuter en lots sans en exclure aucun.

**Critères d’acceptation finaux :**

- zéro action visible marquée ou terminant en `NOT_IMPLEMENTED` ;
- zéro donnée carburant arbitraire dans l’interface ;
- zéro pseudo-capteur sans effet ;
- palette vide : trois éléments maximum ;
- commande structurée : un résultat principal et deux alternatives liées maximum ;
- résumé nominal : quatre lignes maximum, sans tronquer les listes demandées ni les réserves nécessaires ;
- aucune double indisponibilité ;
- menu radial conservé et limité à des actions disponibles ;
- PW conservés dans le bandeau supérieur, avec des libellés et contenus courts ;
- QAK conservées dans le menu latéral, avec un accès en un geste ;
- aucun texte purement cosmétique dans les PW, QAK ou menus radiaux ;
- palette conservée : syntaxes utiles, complétions, gestes compatibles, historique, favoris et accès tactile ;
- aucune exécution automatique sur ambiguïté, saisie ou rappel d’historique ;
- listes demandées complètes et noms accessibles préservés ;
- toutes les capacités de la section « Conserver » vérifiées ;
- tests, typecheck, build, E2E et audit réussis.

## Découpage recommandé en commits

1. `test: define hmi density and action budgets`
2. `refactor: preserve and simplify radial actions`
3. `refactor: clarify simulated route and system information`
4. `refactor: make command results concise and relevant`
5. `refactor: simplify permanent widgets and quick access keys`
6. `refactor: simplify local action confirmations`
7. `docs: align interface guides with simplified hmi`

Chaque commit doit rester réversible. Ne pas fusionner la suppression des capacités fictives avec la réécriture visuelle de la palette dans un même commit.

## Risques et parades

- **Retirer une fonction utilisée dans un test plutôt que dans l’application :** vérifier les imports de production avant suppression, puis supprimer les tests obsolètes au lieu de conserver du code pour eux.
- **Confondre simplification et perte de capacité :** protéger d’abord les résultats métier par des tests indépendants de leur présentation.
- **Confondre la structure mission avec le bruit visuel :** conserver explicitement le menu radial, les PW et les QAK dans les tests d’acceptation.
- **Casser l’usage tactile :** conserver un accès visible à la palette et tester à 1024 × 768.
- **Réintroduire du bruit par les erreurs :** afficher une seule réserve actionnable, pas une pile de statuts.
- **Déplacer toute la complexité dans un autre menu :** appliquer les mêmes critères au mode développeur ; ne pas créer une nouvelle toolbox générale.
- **Masquer une donnée de sécurité :** conserver le statut de navigation et le caractère simulé, mais sous une forme compacte et non décorative.

## Hors périmètre

- ajout d’une vraie avionique ou de vrais capteurs ;
- ajout d’un modèle carburant ;
- ajout d’une planification opérationnelle ;
- refonte graphique complète ;
- persistance ou synchronisation réseau ;
- intégration à un système réel.

L’assainissement retire les promesses que FakeMS ne peut pas tenir. Il ne tente pas de les remplacer par une simulation plus complexe.
