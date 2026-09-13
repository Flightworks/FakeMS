# Baseline IHM FakeMS — comparaison dev/main

> **L0/T02 — artefact de référence.** Cette fiche consigne l’état audité avant L0 et des mesures de l’interface existante. Elle ne décrit pas une implémentation nouvelle et ne revendique ni ergonomie démontrée, ni qualification opérationnelle, ni certification cockpit.

## Références et portée

| Référence | Valeur auditée | Usage |
| --- | --- | --- |
| Dépôt | `/tmp/fakems-audit` | Copie de qualification |
| Dev | `dev/mission-simulation-foundation` — `69b1392a6c1859f8cfd919a9095b66b77bed415a` — version `1.4.0` | Baseline principale |
| Main | `main` — `5d528c2989f95e982309001dbff3d5ffd127280e` — version `1.3.6` | Comparaison historique |
| URL observée pendant l’audit | `http://192.168.1.99:4173/FakeMS/` — HTTP 200 | Contexte de mesure, pas preuve d’offline |

Au début de l’audit, aucun diff suivi n’était présent. Les éléments non suivis `.hermes/` et `tests/utils/.hermes-tmp.z8Zqqd` existaient déjà et sont hors périmètre ; ils doivent rester préservés. Le présent fichier et les autres livrables L0 ne doivent pas être confondus avec cette photographie initiale.

## Méthode et limites

L’audit a combiné lecture du code, comparaison Git, mesures de fichiers et essais Playwright en contexte isolé aux dimensions `1366 × 768` et `1024 × 768`. Trois revues en lecture seule ont couvert les commandes/PW/radiaux, les résultats/données et la cartographie.

Cette méthode n’incluait pas de tablette physique, gants, soleil, vibrations, poste équipage, participants représentatifs, mesure NASA-TLX ou campagne navigateur complète de `main`. La suite de non-régression n’a pas été relancée pendant l’audit, car sa configuration reconstruit `dist/` et peut entrer en conflit avec un preview utilisateur. Les dimensions DOM et styles calculés décrivent ces conditions ; elles ne prouvent pas une facilité d’usage. Les anciens tests, même verts, ne qualifient pas les objectifs ergonomiques de L0.

## Mesures et problèmes observés

| ID | Observation mesurée | Portée du constat |
| --- | --- | --- |
| A01 | Dans `dev`, les contextes radiaux renvoient tous `TRACKS → VECTOR` ; la comparaison de code trouve 29 callbacks radiaux dans `main`, dont 28 `alert()`, contre un seul callback dans `dev`. | L’identité du contexte et l’effet ne sont pas démontrés de façon comparable. |
| A02 | `VEC` observé `ON → OFF`, mais le nombre de polylignes vecteurs reste `3 → 3`. | L’état commandé et le rendu cartographique divergent. |
| A03 | `RESET` depuis le PW produit `RESET · PAUSED` sans dialogue de confirmation monté. | Un chemin PW contourne la protection observée dans d’autres chemins. |
| A05 | À `1024 px`, la ligne de palette mesure `598 px` ; le bloc résultat mesure `902,6875 px` et atteint `x = 1185,6875` ; le texte secondaire est à `12 px` et déborde le panneau. | La valeur principale et la qualification sont difficiles à hiérarchiser dans cette condition. |
| A06/A07 | Les sorties observées mélangent absence de vitesse, fraîcheur inconnue, référence ambiguë et suggestions parasites (`DCT`/`SAVE`) selon la requête. | Les causes et intentions ne sont pas suffisamment séparées. |
| A08 | Les chemins clic/`Entrée`/glissement/dépôt ne transportent pas toujours le même contexte ; toutes les lignes non désactivées sont déclarées déplaçables. | Une activation et son effet peuvent diverger selon le geste. |
| A09 | Les PW `STABLN`/`HMI` exposent des abréviations et cycles de réglage ; les boutons `POS/SCL/ALP/VEC/DET` mesurent `32 px` de haut avec une police de `12 px`. | L’état et l’effet sont peu explicites pour une interaction tactile. |
| A10 | Les panneaux mélangent état SIM/GPS, `TAS`/vitesse sol et durée `T+`/époque ; `isSecureContext=false`, le presse-papiers est absent sur l’URL HTTP LAN et NAV affiche `GPS DENIED`. | Les sources et domaines temporels doivent être distingués avant toute mesure d’usage. |
| A11 | Le radial est mesuré avec du texte de `8/9 px` et n’a pas d’adaptation de bord démontrée ; `uiScale` ne l’agrandit pas transversalement. | Les objectifs tactiles restent à vérifier, sans conclure à une ergonomie actuelle. |
| A13 | En cas d’échec du détail côtier, un chemin rempli `#090d12`, opacité `1`, sans contour reste visible dans le panneau. | Le repli peut être pris pour une zone maritime ; le fond global n’est pas une preuve de repli correct. |
| A16 | `tests/e2e/pie-menu.spec.ts` et des tests de présence/fermeture vérifient des éléments de structure, pas l’effet cartographique ni la charge de travail. | Ces résultats historiques ne démontrent pas l’utilité ou l’ergonomie. |

Extraits de résultats de l’audit, conservés comme observations et non comme fixtures de la future interface :

```text
ETE BRAVO
4.4 NM · ETE: UNAVAILABLE · SPEED_UNAVAILABLE · ETA UTC: UNAVAILABLE
· ETA LOCAL (UTC): UNAVAILABLE · GS: UNAVAILABLE · SRC: UNAVAILABLE
Puis : DIRECT TO / DCT BRAVO ; SAVE: "ETE BRAVO"

ETE BRAVO @ 120KT
ETE: 2 min 13 s ; GS: 120.0 KT ; USER_ASSUMPTION ; SRC: USER_INPUT

SIM STATUS
RUNNING · SIM T+1789236156s · LOCAL SIMULATION · NO SIDE EFFECT
```

La valeur `ETA` dépend du moment d’ouverture ; `T+1789236156s` est une chaîne observée dans ce contexte, pas une valeur à figer. Aucun extrait ne prouve qu’une position scénario est une position GPS valide.

## Maquettes statiques de comparaison

Ces blocs sont des textes de conception pour préparer les scénarios ; ils ne sont ni des captures, ni des contrats de code, ni la preuve que les fonctions existent.

### Badge de résultat

Fixture illustrative : distance `20 NM`, vitesse sol `120 kt`, durée `600 s`.

```text
[DISPONIBLE]
ETE vers BRAVO                    [10 min] [SCÉNARIO]
Distance 20 NM · GS 120 kt        [Détails] [Copier]

[PARTIEL]
ETE vers BRAVO                    [—]
Vitesse sol absente               [Hypothèse] [Détails]

[HYPOTHÈSE]
ETE vers BRAVO                    [10 min] [GS HYPOTHÈSE 120 kt]
Position : SCÉNARIO               [Détails] [Copier]
```

Le badge réserve la valeur principale et son unité ; la qualification proche explique le sens. `Copier` ou l’affichage sur carte sont des actions explicites et doivent signaler honnêtement une indisponibilité.

### Cinq contextes radiaux

```text
[FOND DE CARTE]
  VUE        → Centrer ici · Recentrer ownship · Nord en haut · Cap en haut
  AFFICHAGE  → Vecteurs · Étiquettes · Grille · Allègement
  MESURER    → Depuis ownship · Choisir l’origine · Coordonnées
  CRÉER      → Repère local · Waypoint local

[OWNSHIP]
  NAV SIM      → Cap/vitesse · Pause/reprise · Route active
  STABILISER   → Suivre ownship · Ancrer sol · Recentrer
  TRAJECTOIRE  → Afficher/masquer · Position future · Effacer [confirmer]
  DONNÉES      → Navigation/source · Cinématique

[WAYPOINT]
  DIRECT SIM → Direct simulé [confirmer/proposer]
  MESURER    → Distance/relèvement · ETA/ETE · Projection paramétrée
  POINT      → Centrer · Coordonnées
  ROUTE      → Ajouter au brouillon · Position dans le plan

[PISTE]
  DONNÉES    → Informations · Âge · Qualité
  MESURER    → Distance/relèvement · CPA/TCPA · Rapprochement
  SUIVI      → Centrer · Trajectoire · Position future
  DÉSIGNER   → Repère à la position · Bullseye à la position

[BASE SCÉNARIO]
  DONNÉES    → Identité/coordonnées · Données scénario
  REJOINDRE  → Direct simulé · ETA/ETE
  MESURER    → Distance/relèvement · Projection
  VUE        → Centrer · Référence bullseye
```

L’ordre est stable par contexte et la profondeur est limitée à deux niveaux. Chaque feuille doit satisfaire la règle de capacité simulée observable ; la maquette ne rend aucune feuille fonctionnelle.

### États des PW

```text
PW STABLN
  fermé : SOL · NORD
  ouvert : Ancrage [Suivre ownship | Sol]
           Orientation [Nord | Cap] · Recentrer
           Retour [Animé | Instantané] · Fermer

PW HMI
  fermé : TACTILE · personnalisé
  ouvert : Lisibilité · Gestes · Panneau ownship
           Taille/opacité explicites · Essai sans effet mission · Fermer

PW NAV
  fermé : SIM · PAUSE
  ouvert : Source [Scénario | GPS | Position conservée]
           Cap/vitesse · Pause/Reprise · RESET [confirmer]
           Heure UTC / durée scénario · Fermer
```

Les états fermés doivent être utiles sans survol. Les valeurs et confirmations restent à raccorder et à mesurer dans les lots ultérieurs.

## Décisions encore ouvertes

- Valider le démarrage recommandé en `SCÉNARIO` en pause, sans exiger le GPS, plutôt que le démarrage `REAL` observé.
- Fixer le matériel cible, sa résolution physique, l’orientation, la distance d’usage et le besoin de gants avant de transformer `48 × 48 px CSS`, `18 px`, `14 px` et les ratios de contraste en critères physiques.
- Arbitrer le vocabulaire visible (français clair, identifiants de commande conservés) et les variantes de conception : badge compact, radial tap-à-tap ou geste expert, PW explicites ou réglages historiques.
- Décider séparément la source cartographique locale et ses limites ; ce baseline ne tranche pas ce choix.

## Références de travail

- [Principes IHM de FakeMS](../architecture/hmi-guidelines.md)
- [Check-list de revue IHM](../testing/hmi-review-checklist.md)
- [Scénarios de tâches L0/T02](../testing/hmi-task-scenarios.md)

Le prochain lot devra remplacer les écarts par des effets observables et rejouer les scénarios. Tant que cette preuve n’existe pas, le baseline reste une référence historique, pas une annonce de comportement livré.
