# Inventaire des textes IHM FakeMS

> Inventaire initial établi pendant l’exécution du plan d’assainissement.
>
> Règle : conserver l’architecture PW, QAK, menu radial et palette. Cette liste classe leur contenu, pas leur existence.

## Légende

- **CONSERVER** : état, action, valeur, unité, avertissement ou accessibilité.
- **RACCOURCIR** : sens utile, formulation trop longue ou répétée.
- **SUPPRIMER** : texte cosmétique, conseil permanent ou promesse non réalisée.
- **À VÉRIFIER** : le texte reste affiché tant que l’effet associé n’est pas vérifié.

## Palette de commandes

### En-tête

- `Command input` — **CONSERVER** : nom accessible du champ.
- `Type a command (e.g., 'DCT', 'TK2 180 5')...` — **RACCOURCIR** : garder un exemple court et stable.
- `Copy Input` — **CONSERVER** : action explicite disponible lorsque le champ n’est pas vide.
- `ESC` — **CONSERVER** : fermeture visible et accessible.

### Bandeau d’état

- `TYPE TO SEARCH COMMANDS OR ENTITIES` — **RACCOURCIR** : une invitation courte lorsque la palette est vide.
- `TRY: '12*5', '10km to nm', 'TK2 180 5'` — **RACCOURCIR** : ne pas afficher plusieurs conseils en même temps.
- `CALCULATOR MODE ACTIVE` — **SUPPRIMER** si la commande affiche déjà son résultat ; conserver seulement une indication de chargement lorsque le calcul asynchrone est réellement en cours.
- `BEARING/RANGE PROJECTION MODE` — **RACCOURCIR** ou afficher seulement pendant la saisie d’une projection.
- `HISTORY (n)` — **CONSERVER** : état de navigation dans l’historique, sans présenter l’historique comme une persistance externe.
- `CALCULATOR LOADING…` — **CONSERVER** : état temporaire accessible.

### Résultats

- `DIRECT TO` — **SUPPRIMER** lorsqu’il est attaché à un calcul, une consultation ou un réglage. Garder un libellé propre au DCT lorsque l’action est réellement un DCT.
- `No commands found for ...` — **RACCOURCIR** : message court avec une correction possible si elle existe.
- `PRO TIP: Swipe Right to Execute • Drag to Map` — **SUPPRIMER** du pied permanent. Les gestes restent testés et documentés à la demande.
- `TACTICAL COMMAND PALETTE` — **SUPPRIMER** du pied permanent : le rôle est déjà donné par le dialogue accessible.
- `Copy History Item` — **CONSERVER** : action de copie sur une entrée d’historique.

## PW du bandeau supérieur

### PW fermés

- horloge UTC avec `Z` — **CONSERVER** : état temporel.
- `NAV` + état de navigation — **CONSERVER** : état et accès au contrôle de navigation/simulation.
- `STABLN` + `CFG` — **CONSERVER** : PW de stabilisation demandé par l’architecture mission.
- `HMI` + `CFG` — **CONSERVER** : PW de configuration IHM demandé par l’architecture mission.

### PW `NAV` ouverts

- `Sim Toolbox` — **RACCOURCIR** en `SIM` ou `NAV` selon le libellé retenu.
- `SIM CLOCK` + état — **CONSERVER** : état de simulation.
- `PAUSE`, `RESUME`, `RESET`, `REPLAY` — **CONSERVER** : actions de simulation.
- `Mode`, `REAL`, `SIM` — **CONSERVER** : état et choix de source.
- `Target Heading`, `Target Speed`, `Turn Rate` — **CONSERVER** avec unités courtes et exactes.
- `Continuous Turn` — **RACCOURCIR** si l’action reste claire avec les commandes gauche, arrêt et droite.
- `LOCK HDG (Stop Rotation)` — **RACCOURCIR** en `LOCK HDG`; conserver l’état verrouillé.
- `Flying Straight` — **SUPPRIMER** comme explication ; l’état `HDG LOCKED` suffit.
- `Apply All` — **RACCOURCIR** en `APPLY` si l’effet est évident.

### PW `STABLN` ouverts

- `Stab Options` — **RACCOURCIR** en `STAB` ou `STAB CFG`.
- `Auto GND on Pan`, `Freeze HDG (GND)`, `Snap Recenter`, `Recenter on Orient`, `Smooth Unfreeze`, `Maintain Pos on Orient` — **À VÉRIFIER** : conserver chaque réglage qui modifie réellement la stabilisation ; raccourcir seulement son texte.
- `ON`, `OFF`, délais et icône d’aide — **CONSERVER** si le réglage est actif et compréhensible.
- paragraphes d’aide au survol — **RACCOURCIR** : une phrase factuelle au maximum, à la demande.
- `Auto Recenter` et son délai — **CONSERVER** si l’effet est actif ; afficher la durée avec son unité.

### PW `HMI` ouverts

- `HMI Config` — **RACCOURCIR** en `HMI` ou `HMI CFG`.
- catégories `HUD`, `GEST`, `VIS` — **CONSERVER** : catégories compactes de réglages.
- `POS`, `SCL`, `ALP`, `VEC`, `DET`, `TAP`, `IND`, `HLD`, `VSCL`, `GLO`, `DIM`, `ANI` — **CONSERVER** si leurs valeurs modifient effectivement l’interface.
- valeurs `ON`, `OFF`, échelles, millisecondes et pourcentages — **CONSERVER** avec unités et état courant.
- descriptions longues — **RACCOURCIR** ou déplacer à l’aide à la demande.

## QAK du menu latéral

- bouton d’ouverture/fermeture `Toggle tactical menu` — **CONSERVER** : accès structurel.
- `STAB` + `GND` ou `H/C` — **CONSERVER** : état et action rapide.
- `VER` + version — **À VÉRIFIER** : conserver la QAK si elle fait partie du shell mission ; retirer le détail de changelog de la vue tactique si aucune décision ne l’utilise.
- `FIND` + `CMD` — **CONSERVER** : accès tactile à la palette.
- titres et descriptions de référence non associés à un enfant QAK actif — **SUPPRIMER** s’ils ne sont jamais rendus.

## Menu radial

- titre accessible `MAP ACTION radial menu` ou `ENTITY ACTION radial menu` — **CONSERVER** : repère d’accessibilité et de test.
- labels de secteurs — **CONSERVER** s’ils mènent à une action effective.
- `DIRECT`, `HOLD`, `FPL`, `OFFSET`, `AUTH`, `ABORT`, `SPI`, `TEXT`, `HANDOFF`, `SQUAWK`, `DLINK`, `FLIR`, `STT`, `LSR`, `DELETE`, `PROP`, `WPT`, `TGT`, `LZ`, `FARP`, `LABELS`, `CLR ALL`, `CENTER`, `MEASURE` — **SUPPRIMER** tant que leur action reste `NOT_IMPLEMENTED`.
- `TRACKS` → `VECTOR` — **CONSERVER** : le réglage des vecteurs a un effet observable.
- textes de description ou slogans dans le secteur radial — **SUPPRIMER** : le contexte spatial fournit le sens.

## Panneaux d’information

- valeurs valides avec unités — **CONSERVER**.
- `HGT N/A` suivi de `UNAVAILABLE · UNAVAILABLE` — **SUPPRIMER** le doublon ; conserver une seule raison courte si elle explique une absence utile.
- coordonnées détaillées — **CONSERVER À LA DEMANDE** si elles ne servent pas la décision permanente.
- classification, fraîcheur, qualité et incertitude — **CONSERVER DANS INFO** lorsqu’elles sont présentes dans les données ; ne pas afficher un champ vide.

## Bandeau de simulation

- avertissement de simulation et de non-emploi opérationnel — **CONSERVER** : frontière de sécurité.
- numéro de build — **SUPPRIMER** de la vue d’usage ; conserver dans les diagnostics et les preuves de qualification.
- phrases répétant que la simulation est locale — **RACCOURCIR** en un badge stable.

## Règle de clôture

Avant de supprimer un texte, vérifier qu’il ne remplit pas l’une de ces fonctions :

1. identifier le contrôle pour l’accessibilité ;
2. montrer un état ;
3. fournir une valeur ou une unité ;
4. signaler une limite ou une erreur ;
5. demander une confirmation ;
6. expliquer une correction nécessaire.

Un texte qui ne remplit aucune de ces fonctions est cosmétique ou hors contexte.
