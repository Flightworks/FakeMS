# Palette de commandes

La palette permet de calculer, consulter et contrôler la simulation locale sans quitter la carte.

> **FakeMS est un prototype.** La palette ne pilote aucun système opérationnel.

## À retenir

- Un **calcul** affiche un résultat sans modifier le scénario.
- Une **prévisualisation** montre un résultat sur la carte sans créer d’action réelle.
- Une commande **locale** modifie seulement l’affichage ou l’état de FakeMS.
- Une commande **simulée** agit uniquement sur le scénario local.
- Un effacement ou une remise à zéro demande une **confirmation**.

Une référence ambiguë ou une donnée indisponible bloque l’action. La palette ne choisit pas une cible au hasard.

## Ouvrir la palette

Utilisez `Ctrl+K`, `Espace`, `\` ou le bouton `⌘` dans la barre latérale.

Fermez-la avec `Échap` ou en cliquant en dehors de la palette.

## Premier essai

```text
BRAVO 090/5 NM
ETA BRAVO
5NM > KM
SIM STATUS
ROUTE STATUS
TRAIL STATUS
```

Lisez l’interprétation affichée avant de valider une commande.

## Calculer et se repérer

Projeter un point à partir d’une cible, d’un relèvement et d’une distance :

```text
BRAVO 090/5 NM
FROM BRAVO 180/5NM
```

Calculer une arrivée, un rapprochement ou une recherche locale :

```text
ETA BRAVO
CPA BRAVO
CLOSURE BRAVO
NEAREST 3 TRACKS
```

Convertir des unités compatibles :

```text
5NM > KM
120KT > KMH
5000FT > M
15MIN > SEC
```

Une unité inconnue ou incompatible produit une erreur. La palette ne fournit pas de conversion approximative.

Formats de coordonnées courants :

```text
N45E006
N4530E00630
45.5, 6.5
-23.5, -45.25
```

Un résultat de coordonnées peut proposer le centrage de la carte, la copie de la position normalisée ou la copie du texte saisi. Il ne crée pas de navigation réelle.

## Consulter le scénario

```text
SIM STATUS
TRACK INFO BRAVO
TRACK AGE BRAVO
ROUTE STATUS
TRAIL STATUS
```

Ces commandes affichent l’état de la simulation, les détails et l’âge d’une piste, la route simulée ou l’historique local des positions.

## Contrôler l’affichage

Couches locales :

```text
LAYERS
LAYER TRACKS ON
LAYER VECTORS OFF
LAYER ROUTE ON
```

Densité des informations :

```text
DECLUTTER MINIMAL
DECLUTTER NORMAL
DECLUTTER FULL
```

Légende, grille et zones :

```text
LEGEND
LEGEND SYMBOL HOSTILE
GRID LATLON ON
GRID LATLON STEP 1MIN
ZONE LIST
ZONE CHECK BRAVO TRAINING-A
```

La grille latitude/longitude est locale. `GRID MGRS` n’est pas disponible.

## Contrôler la simulation

```text
SIM PAUSE
SIM RESUME
SIM TIME
SIM SPEED 2
SIM RESET
SIM REPLAY
```

`SIM RESET` efface l’état local. `SIM REPLAY` réinitialise puis reconstruit le scénario de manière déterministe. Ces deux commandes demandent une confirmation.

## Route et trajectoire

La **route** est le trajet prévu dans la simulation. La **trajectoire** est l’historique local des positions observées.

Route simulée :

```text
ROUTE STATUS
ROUTE SHOW
ROUTE HIDE
ROUTE CLEAR
```

`ROUTE SHOW` et `ROUTE HIDE` changent uniquement la visibilité. `ROUTE CLEAR` demande une confirmation.

Historique local :

```text
TRAIL OWNSHIP ON
TRAIL OWNSHIP OFF
TRAIL BRAVO ON
TRAIL BRAVO OFF
TRAIL STATUS
TRAIL CLEAR BRAVO
```

L’historique est masqué par défaut. Il reste en mémoire dans l’onglet courant et n’est pas transmis à un système extérieur. `TRAIL CLEAR` efface uniquement la cible indiquée et demande une confirmation.

## Interagir avec un résultat

- `↑` et `↓` parcourent l’historique de saisie de l’onglet courant.
- Un clic copie un résultat lorsque cette action est disponible.
- Un résultat compatible peut être glissé vers la carte pour afficher une prévisualisation.
- Un glissement vers la droite lance l’action principale proposée.
- Une erreur indique la forme attendue.
- Une cible ambiguë doit être précisée avant toute action.

[Retour au guide de l’interface](./03-interface-guide.md) · [Retour à l’accueil](../README.md)
