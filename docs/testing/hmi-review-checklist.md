# Check-list de revue IHM

Utiliser cette liste avant d’intégrer une modification visible de FakeMS.

## 1. Utilité

- [ ] Les PW du bandeau supérieur, les QAK latérales et l’accès radial sont conservés.
- [ ] La modification réduit leur contenu sans remplacer leur fonction structurelle.
- [ ] L’élément répond à une question ou déclenche une action identifiable.
- [ ] Son effet est observable dans le simulateur.
- [ ] La donnée affichée possède une source réelle dans le scénario ou un calcul déterministe.
- [ ] Une valeur arbitraire est annoncée comme telle ou reste hors de l’interface normale.
- [ ] Une fonction non implémentée n’apparaît pas.

## 2. Nécessité d’affichage

- [ ] L’élément doit réellement être permanent ; sinon il est contextuel ou à la demande.
- [ ] La même information n’apparaît pas dans deux zones visibles.
- [ ] Les champs sans valeur sont omis plutôt que remplis avec plusieurs mentions `N/A` ou `UNAVAILABLE`.
- [ ] Une réserve ou une source n’est affichée que si elle change la décision.
- [ ] Les réglages utiles restent dans les PW ouverts ; seuls version et diagnostics restent hors de la vue d’usage.

## 3. Palette de commandes

Tester au minimum : saisie vide, `CPA BRAVO`, `SIM RESET`, une commande inconnue et un nom d’entité ambigu.

- [ ] La palette vide affiche au plus trois éléments utiles.
- [ ] Une commande reconnue affiche un seul résultat principal.
- [ ] Il existe au plus deux alternatives et elles correspondent à la même intention.
- [ ] Le résumé nominal contient au plus quatre lignes ; les listes demandées et réserves indispensables ne sont pas tronquées.
- [ ] Aucune valeur n’est répétée entre l’interprétation et le résultat.
- [ ] Aucun `SAVE` ne parasite une commande reconnue ; l’usage existant des notes n’est pas supprimé par le nettoyage.
- [ ] Aucun libellé générique tel que `DIRECT TO` n’est appliqué à une action différente.
- [ ] Une recherche tactique ne propose pas simultanément documents, notes, routes et commandes système.
- [ ] Le résultat principal s’exécute de la même manière au clic et avec `Entrée`.
- [ ] Une saisie incomplète affiche une complétion pertinente, pas une pile d’erreurs et de résultats.
- [ ] Une ambiguïté n’exécute aucune action ; tous les candidats restent accessibles.
- [ ] `INFO`, `AGE`, `QUALITY` et `STALE` conservent leurs intentions distinctes.
- [ ] Aucun résultat n’est inventé pour remplacer une donnée manquante ; unités et références utiles sont conservées.
- [ ] Les gestes compatibles restent disponibles et ne contournent aucune confirmation.
- [ ] Un rappel d’historique remplit la saisie sans exécution automatique.
- [ ] Les mises à jour de pistes ne déplacent ni focus ni sélection.
- [ ] Le clavier tactile ne masque ni résultat principal ni fermeture.
- [ ] Les textes accessibles restent présents même lorsque les textes décoratifs visibles sont retirés.

## 4. Parcours et clics

- [ ] Une consultation ou un calcul demande au plus une validation, sans étape ajoutée pour lire un résultat déjà affiché.
- [ ] Une action locale réversible demande une seule validation.
- [ ] Une action destructive demande au maximum une validation et une confirmation.
- [ ] Aucun parcours principal n’aboutit à `NOT_IMPLEMENTED`.
- [ ] Aucun sous-menu n’existe pour une seule action disponible.
- [ ] Un contrôle désactivé décrit la condition temporaire qui le bloque.
- [ ] Une fermeture ou une annulation est toujours évidente.

## 5. Carte et panneaux

- [ ] La carte reste la zone visuelle dominante.
- [ ] Le fond maritime est sombre, local et ne montre ni routes ni POI civils.
- [ ] Les repères d’aéroports statiques restent discrets, sans remplacer les entités mission.
- [ ] Sans GPS, l’origine visible du scénario est Toulon ; avec GPS, la position réelle prend le relais.
- [ ] Le menu radial reste accessible sur la carte ou l’objet concerné.
- [ ] Chaque secteur radial déclenche une fonction disponible.
- [ ] Les PW indiquent un état ou donnent un accès direct avec un libellé court.
- [ ] Les QAK exécutent leur action en un geste et sans texte d’illustration.
- [ ] Les libellés et vecteurs absents du besoin courant sont masqués par défaut.
- [ ] La sélection d’une entité n’affiche que les données utiles à cette entité.
- [ ] Les coordonnées détaillées sont consultables sans être nécessairement permanentes.
- [ ] Un menu contextuel contient uniquement des actions disponibles.
- [ ] L’avertissement de simulation reste visible sans concurrencer une alerte opérationnelle.

## 6. Présentation

- [ ] L’ambre et le rouge signalent une réserve réelle, pas une décoration.
- [ ] Aucune animation continue n’attire l’attention sans changement d’état.
- [ ] Les unités accompagnent les valeurs numériques.
- [ ] Les textes explicatifs utilisent des phrases courtes.
- [ ] Les abréviations sont stables et compréhensibles dans leur contexte.
- [ ] L’espace disponible n’est pas rempli par défaut.

## 7. Formats et accès

Vérifier l’interface à :

- [ ] 1024 × 768 ;
- [ ] 1366 × 768 ;
- [ ] clavier seul ;
- [ ] pointeur ou tactile ;
- [ ] mode réel ;
- [ ] mode simulation.

## 8. Preuves attendues

Joindre à la revue :

- [ ] une capture de la vue principale ;
- [ ] une capture de la palette vide ;
- [ ] une capture d’un résultat représentatif ;
- [ ] le nombre d’éléments visibles dans chacun de ces états ;
- [ ] le nombre de validations nécessaires pour chaque parcours modifié ;
- [ ] les résultats des tests ciblés, du typecheck, de la suite complète et du build.

Référence : [Principes IHM de FakeMS](../architecture/hmi-guidelines.md).
