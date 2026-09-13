# Check-list de revue IHM

Utiliser cette liste avant d’intégrer une modification visible de FakeMS.

## 1. Utilité

- [ ] Les PW du bandeau supérieur, les QAK latérales et l’accès radial sont conservés.
- [ ] La modification réduit leur contenu sans remplacer leur fonction structurelle.
- [ ] L’élément répond à une question ou déclenche une action identifiable.
- [ ] Son effet est observable dans le simulateur.
- [ ] La donnée affichée possède une source réelle dans le scénario ou un calcul déterministe.
- [ ] Une fonction simulée n’est exposée que si son modèle, ses entrées, son état et son effet local sont observables, avec un libellé honnête (`SIMULÉ`, `SCÉNARIO`, `HYPOTHÈSE` ou `PRÉVISUALISATION` selon le cas).
- [ ] Une fonction sans modèle observable, sans effet local ou qui mène à `NOT_IMPLEMENTED` reste absente du parcours normal ; une valeur arbitraire n’est jamais présentée comme opérationnelle.

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

## 4. Chemins protégés et frontière de confirmation

- [ ] Le radial s’ouvre sur le contexte capturé (fond, ownship, waypoint, piste ou base scénario), conserve un ordre stable, deux niveaux au maximum et l’annulation par le centre, l’extérieur ou `Escape`.
- [ ] Chaque feuille radiale a un modèle, des entrées, un état et un effet local observables ; un anneau vide ou une fonction d’illustration n’est pas ajouté.
- [ ] Le PW expose d’abord un état fermé utile, puis des choix explicites ; les réglages modifiés produisent l’effet décrit.
- [ ] Les QAK `STAB`, `FIND` et `VER` restent accessibles en un geste, avec un retour lisible, sans supprimer un accès protégé pour gagner de la place.
- [ ] La palette sépare saisie, choix explicite, aperçu et exécution ; clic et `Entrée` partagent la même action principale.
- [ ] Radial, PW, QAK et palette utilisent la même cible, le même effet et la même protection pour une même commande.
- [ ] Ouvrir, survoler, saisir, afficher une complétion ou un aperçu ne modifie pas le scénario ; une consultation déposée sur la carte ne prétend pas être une action.
- [ ] La frontière de confirmation est visible juste avant la mutation sensible : action réversible = une validation ; action destructive, `SIM RESET`, `SIM REPLAY`, effacement ou DCT simulé = une validation puis une confirmation, une seule fois.
- [ ] `Annuler` avant ou dans la confirmation préserve l’heure, la cible, les entités, la route et la trajectoire ; aucune voie d’accès ne contourne cette protection.

## 5. Parcours et clics

- [ ] Une consultation ou un calcul demande au plus une validation, sans étape ajoutée pour lire un résultat déjà affiché.
- [ ] Une action locale réversible demande une seule validation.
- [ ] Une action destructive demande au maximum une validation et une confirmation.
- [ ] Aucun parcours principal n’aboutit à `NOT_IMPLEMENTED`.
- [ ] Aucun sous-menu n’existe pour une seule action disponible.
- [ ] Un contrôle désactivé décrit la condition temporaire qui le bloque.
- [ ] Une fermeture ou une annulation est toujours évidente.

## 6. Carte et panneaux

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

## 7. Présentation

- [ ] L’ambre et le rouge signalent une réserve réelle, pas une décoration.
- [ ] Aucune animation continue n’attire l’attention sans changement d’état.
- [ ] Les unités accompagnent les valeurs numériques.
- [ ] Les textes explicatifs utilisent des phrases courtes.
- [ ] Les abréviations sont stables et compréhensibles dans leur contexte.
- [ ] L’espace disponible n’est pas rempli par défaut.

## 8. Formats et accès

Vérifier l’interface à :

- [ ] 1024 × 768 ;
- [ ] 1366 × 768 ;
- [ ] clavier seul ;
- [ ] pointeur ou tactile ;
- [ ] mode réel ;
- [ ] mode simulation.
- [ ] La zone active habituelle atteint au moins `48 × 48 px CSS` ; taille physique, distance d’usage et gants sont vérifiés séparément sur le matériel cible.
- [ ] La valeur principale atteint au moins `18 px` et le texte d’action/qualification au moins `14 px` dans le profil tactile nominal.
- [ ] Le contraste visé est `4,5:1` pour le texte courant et `3:1` pour les composants ou états non textuels pertinents, fonds composés compris.
- [ ] Ces seuils sont consignés comme objectifs de conception du démonstrateur, jamais comme certification cockpit ou qualification aéronautique.

## 9. Preuves attendues

Joindre à la revue :

- [ ] une capture de la vue principale ;
- [ ] une capture de la palette vide ;
- [ ] une capture d’un résultat représentatif ;
- [ ] le nombre d’éléments visibles dans chacun de ces états ;
- [ ] le nombre de validations nécessaires pour chaque parcours modifié ;
- [ ] les résultats des tests ciblés, du typecheck, de la suite complète et du build.
- [ ] la méthode, le nombre de participants et les conditions matérielles si une conclusion ergonomique est formulée.
- [ ] les limites de preuve : une revue statique, DOM ou automatisée établit un contrat technique dans ses conditions, mais ne prouve pas l’ergonomie ; les anciens résultats de tests ne valent pas qualification des objectifs tactiles.
- [ ] l’absence d’essai utilisateur ou de matériel cible est déclarée explicitement ; aucune certification cockpit ou aptitude opérationnelle n’est déduite d’un test vert.
- [ ] le mapping AC01–AC21 et la couverture technique S01–S12 sont consignés dans la [fiche de qualification IHM T30](../reviews/hmi-qualification.md).
- [ ] les résultats facteurs humains manquants sont laissés non renseignés : pas de taux, temps, NASA-TLX, gants, lumière, vibrations, captures ou observation physique inventés.

Référence : [Principes IHM de FakeMS](../architecture/hmi-guidelines.md).
