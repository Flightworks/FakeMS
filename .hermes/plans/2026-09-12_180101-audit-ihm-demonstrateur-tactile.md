# FakeMS — Audit IHM et plan d’amélioration du démonstrateur tactile

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task, uniquement après autorisation d’exécution. Ce document ne constitue pas cette autorisation.

**Goal :** retrouver une interface riche en concepts de mission, compréhensible au toucher, cohérente dans ses données et ses effets, et mesurer son apport à la réduction de charge de travail.

**Architecture :** conserver carte, menus radiaux, PW, QAK et palette. Leur faire partager les mêmes commandes, données qualifiées et états applicatifs. Séparer l’information principale, les précautions indispensables et les détails consultables. Préparer le fond côtier haute définition hors application, puis le distribuer localement.

**Tech Stack :** React, TypeScript, Vite, Tailwind CSS, Framer Motion, Leaflet/react-leaflet, Vitest, Testing Library, Playwright, GeoJSON et service worker existants. GDAL/GEOS envisagés pour la préparation des cartes, pas comme dépendances du navigateur.

**Statut :** audit réalisé ; plan proposé, non exécuté. Aucun changement du code applicatif, aucun build, commit, push, merge, tag, téléchargement géographique lourd ou redémarrage du preview pendant cet audit.

---

## 1. Décision de conception

La simplification précédente a confondu trois choses : retirer les fausses actions, réduire le bruit et réduire les capacités accessibles. Le premier objectif était justifié ; le troisième a appauvri le démonstrateur.

**La nouvelle règle est : réduire l’effort de compréhension et de manipulation, pas la richesse fonctionnelle.**

Une interface de démonstration peut représenter une navigation, un capteur ou une coordination simulés. Chaque fonction doit cependant avoir des entrées, un état et un effet local observables. Un simple message « effectué » ne démontre pas un système de mission.

Reprendre de la 1.3.6 : la hiérarchie visuelle des résultats, la richesse contextuelle et l’exploration des interactions. Ne pas reprendre ses calculs approximatifs ni ses notifications sans effet.

La conformité à l’« état de l’art » ne se déduit pas de l’apparence. Elle nécessite une conception fondée sur les tâches, des états compréhensibles, une prévention des erreurs et une évaluation avec des utilisateurs représentatifs. Ce plan prépare cette évaluation ; il ne revendique aucune qualification aéronautique.

## 2. Périmètre, références et preuves

### 2.1 Références figées

- Dépôt : `/tmp/fakems-audit`.
- Branche auditée : `dev/mission-simulation-foundation`.
- HEAD : `69b1392a6c1859f8cfd919a9095b66b77bed415a`, version 1.4.0.
- Comparaison : `main`, `5d528c2989f95e982309001dbff3d5ffd127280e`, version 1.3.6.
- URL auditée : `http://192.168.1.99:4173/FakeMS/`, réponse HTTP 200 pendant les contrôles.
- Git initial : aucun diff suivi ; `.hermes/` et `tests/utils/.hermes-tmp.z8Zqqd` non suivis préexistants. Les préserver.
- Les numéros de ligne ci-dessous se rapportent à ce HEAD. Ils devront être réactualisés si la branche évolue avant exécution.

### 2.2 Méthode et couverture

Trois revues indépendantes en lecture seule ont couvert les commandes/PW/radiaux, les résultats/données et la cartographie. Leurs constats principaux ont été recoupés par lecture du code, commandes Git, calculs sur les fichiers et essais Playwright sur le preview existant.

Surfaces examinées : carte et symboles, fond côtier et aéroports, sélection/aperçus, couches et allègement, trajectoires et routes, menus radiaux, PW NAV/STABLN/HMI, QAK STAB/VER/FIND, palette/résultats/historique, panneaux ownship et cible, confirmations, propositions/justifications, journal d’actions, bandeau simulation, documents/changelog, mise à jour PWA et états hors ligne. `SideMenu.tsx`, ancien composant non monté par App, n’est pas considéré comme une surface active à redessiner.

Reproductions navigateur instrumentées aux dimensions 1366×768 et 1024×768. Les manipulations sont limitées à des contextes de navigateur isolés et à l’état local de simulation ; elles ne modifient pas le scénario d’une session utilisateur ouverte ailleurs.

**Limites :** comparaison de main par le code, pas par une campagne navigateur sur main. Pas de tablette physique, gants, vibrations, soleil, poste équipage ni mesure de charge de travail. L’analyse visuelle automatisée de la capture n’a pas été disponible ; les conclusions de taille/débordement reposent sur le DOM et les styles calculés, pas sur une prétendue lecture visuelle. La suite de non-régression n’a pas été relancée : sa configuration reconstruit `dist/` et peut entrer en conflit avec le preview utilisateur. Les anciens résultats de tests ne qualifient pas les nouveaux objectifs ergonomiques.

### 2.3 Preuves reproductibles de cet audit

Fichiers de preuves locaux, hors sources applicatives :
- `/tmp/fakems-hmi-audit-evidence.json` : résultats des requêtes, contexte sécurisé, dimensions et erreurs de page.
- `/tmp/fakems-hmi-audit-controls.json` : effet VEC, RESET PW, tailles et panne du détail côtier.
- `/tmp/fakems-hmi-audit-source-measures.json` : comptages main/dev et mesures de l’asset côtier.

Extraits réellement observés :

```text
ETE BRAVO
4.4 NM · ETE: UNAVAILABLE · SPEED_UNAVAILABLE · ETA UTC: UNAVAILABLE
· ETA LOCAL (UTC): UNAVAILABLE · GS: UNAVAILABLE · SRC: UNAVAILABLE
Puis : DIRECT TO / DCT BRAVO ; SAVE: "ETE BRAVO"

ETE BRAVO @ 120KT
ETE: 2 min 13 s ; GS: 120.0 KT ; USER_ASSUMPTION ; SRC: USER_INPUT

NEAREST 2 WAYPOINTS
G01 et BRAVO : FRESHNESS: UNKNOWN · QUALITY: UNKNOWN · SRC: UNKNOWN
Puis : SAVE: "NEAREST 2 WAYPOINTS"

CPA HOSTILE 1
UNAVAILABLE ; AMBIGUOUS OR UNKNOWN REFERENCE

SIM STATUS
RUNNING · SIM T+1789236156s · LOCAL SIMULATION · NO SIDE EFFECT
```

L’heure ETA dépend du moment d’ouverture ; ce document ne fige pas cette valeur dynamique. Aucun de ces exemples ne démontre qu’une position scénario est une position GPS valide.

Autres mesures :
- `isSecureContext=false`, `navigator.clipboard` absent sur l’URL HTTP LAN. `navigator.geolocation` existe, mais NAV affiche `GPS DENIED`.
- VEC : `ON → OFF`, nombre de polylignes vecteurs `3 → 3`.
- RESET PW : `RESET · PAUSED`, aucun dialogue de confirmation monté.
- Palette à 1024 px : ligne de 598 px ; bloc résultat de 902,6875 px, allant jusqu’à x=1185,6875 ; texte secondaire de 12 px. Le texte dépasse réellement le panneau.
- Boutons HMI POS/SCL/ALP/VEC/DET : hauteur mesurée 32 px, police 12 px.
- Détail côtier bloqué : un chemin rempli `#090d12`, opacité 1, sans contour reste dans le pane de détail.
- Aucune erreur JavaScript de page dans les parcours de requêtes réussis. Cela ne couvre pas tous les parcours de l’application.

## 3. Audit : écarts et priorités

**P0 :** incohérence d’état, de données ou de protection à corriger avant de présenter une démonstration enrichie. Ce classement est une priorité produit, pas une classification de sécurité aéronautique.

**P1 :** obstacle important à la compréhension, à l’interaction tactile ou à la crédibilité du démonstrateur.

### A01 — P1 — Radiaux réduits à une seule chaîne

- **Constat :** tous les contextes retournent `TRACKS → VECTOR` : fond, ownship, waypoint, piste, base. L’identité du contexte ne change pratiquement que le titre.
- **Preuve :** `components/MapDisplay.tsx:575–587,1381–1387`. Comparaison mécanique : main possède 29 callbacks radiaux, dont 28 `alert()` ; dev un seul callback.
- **Conséquence :** ni choix représentatif, ni exploration contextuelle, ni apprentissage des familles d’actions.
- **Correction :** arbres contextuels riches reposant d’abord sur les capacités déjà présentes. Remplacer les anciennes fausses actions par des effets locaux modélisés, pas par un anneau vide.
- **Couverture actuelle :** `tests/e2e/pie-menu.spec.ts` entérine cette réduction sans vérifier l’effet cartographique de VECTOR.

### A02 — P0 — Deux états concurrents pour les vecteurs

- **Constat :** PW HMI et radial changent `gestureSettings.showSpeedVectors`. Le rendu consulte `layers.VECTORS.visible` et le declutter.
- **Preuve :** `MapDisplay.tsx:582–585,722–735`, `TopSystemBar.tsx:289`, `utils/CommandRegistry.ts:1109–1117`. Reproduction VEC ON/OFF sans disparition des trois vecteurs.
- **Conséquence :** une commande peut afficher l’inverse de la carte.
- **Correction :** un état de couche unique ; état demandé et masquage par allègement distingués. Tous les accès doivent afficher le même état effectif.

### A03 — P0 — Confirmation RESET/REPLAY contournée par le PW NAV

- **Constat :** le PW appelle les contrôles bruts, la palette demande une confirmation.
- **Preuve :** `TopSystemBar.tsx:469–480`, `App.tsx:141–148,1345`, `utils/useSimulation.ts:76–105`. RESET immédiat reproduit.
- **Conséquence :** perte imprévue du contexte de démonstration et comportement différent selon le point d’entrée.
- **Correction :** partager les commandes de demande, confirmation et annulation. Vérifier aussi DCT, effacement des trajectoires et suppression de repères.

### A04 — P0 — Sources de navigation et cinématique incohérentes

- **Constat :** démarrage en REAL ; vitesse ETE fournie seulement en SIM. L’adaptateur GPS ne transporte ni vitesse ni route sol. CPA lit d’autres métadonnées, préremplies pour ownship et conservées lors du mouvement.
- **Preuve :** `App.tsx:87–117,153–159,1135–1137`, `adapters/geolocation.ts:3–6,38–45`, `CommandRegistry.ts:465–484,3053–3066`, `domain/kinematics.ts:75–82`.
- **Conséquence :** un fix GPS ne suffirait pas à rendre ETE disponible ; inversement certains calculs peuvent utiliser un vecteur initial de scénario avec une position d’une autre origine. `@120KT` ne qualifie pas à lui seul la position.
- **Correction :** contrat commun des positions, vitesses, vecteurs, horloges, fraîcheur et hypothèses. Séparer mouvement simulé, acquisition GPS et source utilisée pour une estimation.

### A05 — P1 — Hiérarchie des résultats et largeur dégradées

- **Constat :** le badge principal de main a été remplacé par une longue chaîne secondaire grise. La chaîne déborde ; le panneau d’interprétation ETE n’affiche pas un résultat structuré.
- **Preuve :** `main:components/CommandPalette.tsx:290–295`, commit `0eda3d9`, `components/CommandPalette.tsx:1005–1013`, `CommandInterpretationPanel.tsx:173–174`. Mesures DOM en §2.3.
- **Conséquence :** la valeur utile demande plus de recherche visuelle ; unités, cause et source peuvent être hors du panneau.
- **Correction :** badge réservé à la valeur principale et à son unité ; qualification indispensable adjacente ; détails dépliables. Corriger le dimensionnement flex, sans se contenter d’une ellipsis.
- **Ne pas régresser :** main calculait ETA par une approximation géographique et ne possédait pas une branche ETE équivalente. Restaurer la présentation, pas cet algorithme.

### A06 — P1 — UNKNOWN et UNAVAILABLE regroupent des situations différentes

- **Constat :** donnée inconnue, fraîcheur non applicable à un waypoint, entrée absente, référence ambiguë et hypothèse se présentent comme des échecs techniques similaires.
- **Preuve :** `domain/etaEte.ts:108–162`, `domain/spatialQueries.ts:123–125`, `domain/trackDetails.ts:62–69,101–110`, `CommandRegistry.ts:551–570,1705–1712`.
- **Correction :** états distincts et raison utile, courte. Conserver les qualités qui changent l’interprétation ; ne pas remplacer les vrais inconnus par de fausses valeurs. Expliquer par exemple « Vitesse sol absente », pas six répétitions d’indisponibilité.

### A07 — P1 — Requêtes exactes polluées et ambiguïtés mal résolues

- **Constat :** ETE propose aussi DCT et SAVE ; NEAREST ajoute SAVE. Un nom composé peut être découpé comme deux références ; `CPA HOSTILE 1` donne une réponse fusionnant ambiguïté et absence.
- **Preuve :** reproductions §2.3 ; `CommandRegistry.ts:3014–3015,3034–3051,3179–3197`, `domain/commandParser.ts:427–446`, `domain/entityResolution.ts:25–33`.
- **Correction :** une intention structurée reconnue donne son résultat et ses seules corrections pertinentes. Résoudre les noms composés via les identifiants et toutes les segmentations plausibles ; présenter les candidats plutôt que deviner. Ne pas imposer une nouvelle syntaxe sans préserver l’ancienne.

### A08 — P0 — Activation et calcul diffèrent selon le geste

- **Constat :** clic/Enter/swipe passent par un exécuteur ; le drop reconstruit un contexte partiel puis appelle l’action. Toutes les lignes non désactivées sont déclarées déplaçables, même sans effet carte.
- **Preuve :** `CommandPalette.tsx:722–805,973–989`, `App.tsx:950–1007`. Le contexte drop omet notamment vitesse, horloge, trails, timers, simulation et aperçu CPA.
- **Correction :** résultat calculé une fois, contexte commun, capacité de déplacement explicite. Un résultat purement consultatif peut se copier ; il ne doit pas prétendre être une action carte.

### A09 — P1 — PW STABLN/HMI organisés selon les réglages internes

- **Constat :** `CFG`, `POS/SCL/ALP/VEC/DET`, `TAP/IND/HLD` et `VSCL/GLO/DIM/ANI` obligent à mémoriser les abréviations. L’aide dépend souvent de `title` ou du survol. Les valeurs sont modifiées par cycles peu découvrables.
- **Preuve :** `TopSystemBar.tsx:120–184,281–350,601–610`. Boutons HMI de 32 px. Plusieurs toolboxes peuvent être ouvertes simultanément.
- **Correction :** tâches et états explicites, aide accessible au toucher, choix visibles, un seul panneau transitoire développé par défaut. Garder un épinglage volontaire pour une comparaison utile.
- **Points à qualifier :** libellés Auto GND/Freeze/Smooth Unfreeze parfois éloignés du comportement ; `GLO` agit sur le radial plutôt que sur le HUD. Tester la carte réellement produite, pas une copie de logique dans un test.

### A10 — P1 — Modes, unités et temps imposent une interprétation implicite

- **Constat :** NAV peut afficher GPS DENIED pendant que le panneau ownship montre 120 kt et 3428 ft issus de l’initialisation ; le champ vitesse est étiqueté TAS alors qu’ETE et le modèle de déplacement exploitent une vitesse sol. `SIM STATUS` étiquette une époque Unix comme une durée T+.
- **Preuve :** `App.tsx:87–117`, `components/InfoPanels.tsx`, `CommandRegistry.ts:1371–1372`, `utils/useSimulation.ts:43–45`, observations §2.3.
- **Correction :** distinguer état scénario, source position, source vitesse et disponibilité réelle. Ne pas appeler TAS une GS. Séparer heure UTC scénario, durée depuis début scénario et heure réelle. Pas d’altitude, météo ou carburant « plausibles » sans modèle documenté.

### A11 — P1 — Lisibilité tactile et carte non protégées globalement

- **Constat :** radial en 8/9 px et orientation fixe ; pas d’adaptation démontrée aux bords. `uiScale` agrandit PW/QAK, pas le radial. `mapDim` applique l’opacité à tout MapDisplay, symboles et menus compris. FIND est derrière le volet QAK fermé au repos.
- **Preuve :** `PieMenu.tsx:69–84,291,373–415`, `App.tsx:250,1018–1031,1078,1335`, `LeftSidebar.tsx:57,122–148,193–196`.
- **Correction :** tokens communs, zones tactiles mesurées, agrandissement transversal, atténuation du fond seulement, accès rapide à FIND et état STAB lisible. Ne pas supprimer VER ou une interaction protégée pour gagner de la place.
- **Complément :** focus, annulation, clavier virtuel, gestes concurrents et masquage par la main restent à qualifier sur matériel.

### A12 — P1 — Natural Earth ne fournit pas le détail côtier attendu

- **Constat :** `10m` signifie 1:10 millions. La source est généralisée pour une petite échelle cartographique, pas pour distinguer les quais d’un port.
- **Preuve :** source [R6] ; asset régional de 71 576 octets, 8 features, 46 polygones et 3 334 sommets. Dans la fenêtre `[5.7,42.9,6.2,43.3]`, les 52 segments entièrement inclus mesurent de 589 à 4 622 m ; médiane 1 482 m.
- **Interprétation :** ces longueurs décrivent l’échantillonnage, pas l’incertitude géographique. Ajouter des points interpolés ou arrondir les angles ne recrée pas le détail manquant.
- **Correction :** vraie source locale plus détaillée, avec niveaux de détail et limites documentées.

### A13 — P0 — La panne du détail côtier masque le fond de secours

- **Constat :** le rectangle marin opaque est rendu même lorsque le chargement du détail échoue.
- **Preuve :** `TacticalCoastalDetail.tsx:26–34,47–64` ; requête du GeoJSON bloquée, rectangle marin toujours rendu.
- **Correction :** publier remplacement/marqueur de validité ensemble, après validation. En cas d’échec, conserver le fond global et indiquer discrètement « détail côtier indisponible ».

### A14 — P1 — Découpe et contour cartographiques fragiles

- **Constat :** chaque anneau est découpé séparément sans reconstruction robuste des composantes/trous. Le contour du polygone dessine aussi les bords artificiels de découpe.
- **Preuve :** `scripts/prepare-toulon-coastal-detail.mjs:27–70`, `TacticalCoastalDetail.tsx:53–62`. Des coordonnées consécutives du premier anneau réel sont dupliquées au bord `[14,38]`. La revue dédiée a également exercé des concavités, trous ouverts et tangences ; une validation GEOS exhaustive de l’asset reste à faire.
- **Correction :** validation topologique hors application ; terre remplie sans contour artificiel ; vrai trait côtier séparé, découpé à partir de la source.

### A15 — P1 — Offline et provenance incomplets pour une extension haute définition

- **Constat :** les assets actuels sont référencés par le SW, mais les tests offline/PWA ne prouvent pas le rendu du détail après reload ni l’intégrité d’un futur pack. L’attribution Leaflet est désactivée.
- **Preuve :** `public/sw.js:8–24`, `MapDisplay.tsx:776`, `tests/e2e/offline.spec.ts:25–33`, `tests/e2e/pwa-update.spec.ts:11–15,31–35`.
- **Correction :** manifeste versionné, cache transactionnel du pack, état « prêt hors ligne » vérifié et attribution accessible. Ne pas présenter un HTTP 200 comme une preuve d’offline.

### A16 — P1 — Qualification centrée sur la présence, pas sur l’utilité équipage

- **Constat :** des tests vérifient une étiquette raccourcie ou la fermeture d’un menu, sans prouver l’effet ni la lisibilité ; aucune campagne utilisateur de charge de travail n’est documentée pour ces choix.
- **Preuve :** `tests/e2e/pie-menu.spec.ts`, `tests/components/TopSystemBar.test.tsx:82–110`, `tests/utils/stabilisation.test.ts:112–132`, documentation HMI existante.
- **Correction :** tests d’effets de bout en bout, matrice contrôle/fonction, évaluation comparative et mesure des erreurs de mode. Un test vert ne doit plus garantir un menu volontairement pauvre.

## 4. Contrats de conception à adopter

### 4.1 Préserver la structure, rendre l’état visible

- PW permanents en haut ; QAK latérales ; carte centrale ; radiaux contextuels ; palette pour recherche et saisie experte.
- Même commande, même cible, même effet et même confirmation quel que soit le chemin.
- Une action réversible d’affichage n’exige pas une confirmation systématique. Une réinitialisation, une suppression ou une activation de route l’exige.
- Une fonction indisponible reste explicable et non exécutable lorsqu’elle aide à comprendre le contexte. Ne pas remplir le menu de commandes mortes.
- Ordre des secteurs stable dans chaque contexte. Pas de reclassement automatique « intelligent » selon la fréquence : il détruirait la mémoire gestuelle.
- Pas de changement silencieux de SIM vers GPS ou inversement. La perte GPS ne doit pas déplacer immédiatement ownship vers Toulon ni faire passer une position conservée pour une position actuelle.

### 4.2 Données : scénario, GPS et hypothèse sont trois notions distinctes

**Choix produit recommandé, à valider avant implémentation :** ouverture du démonstrateur sur un scénario Toulon prêt, initialement en pause, sans exiger le GPS du visiteur. Le démarrage est évident et volontaire. L’utilisation du GPS constitue un choix distinct ; ce choix ne transforme pas les autres pistes simulées en données réelles.

Le contexte de calcul doit identifier, pour chaque entrée : objet, origine, unité, instant, domaine d’horloge, fraîcheur, validité et éventuelle hypothèse.

Matrice d’acceptation :
- Positions scénario + GS scénario positive : ETE calculable sans GPS, qualification SCÉNARIO.
- Position GPS valide mais vitesse GPS absente : distance disponible, ETE partielle, raison « vitesse sol absente ».
- Positions qualifiées + `@120KT` : calcul hypothétique, qualification de la vitesse ET provenance des positions visibles.
- GPS refusé : cause distincte d’un contexte HTTP non sécurisé, d’un équipement indisponible ou d’un délai expiré.
- Dernier fix conservé : âge et statut conservé/périmé ; pas de présentation comme fix actuel.
- Vitesse nulle, négative, non finie ou périmée : raisons distinctes ; aucune durée fictive.
- Position et vitesse valides, heure absolue absente : ETE reste calculable ; ETA seule indisponible.
- CPA : vecteurs cohérents avec les positions et frais ; hypothèse « vitesses constantes » visible. Ne pas prendre un vecteur initial de scénario pour une mesure actuelle.
- Route : même contrat de vitesse et de fraîcheur qu’ETE ; pas de calcul parallèle moins exigeant.
- Waypoint fixe : fraîcheur d’observation et qualité capteur non applicables, sauf si le scénario définit réellement une observation de ce point.
- Pause/replay : l’âge scénario suit l’horloge scénario ; l’âge GPS suit la référence réelle prévue. Ne jamais soustraire une durée T+ à un timestamp Unix.

### 4.3 Résultats structurés, pas paragraphes concaténés

Contrat de départ proposé, à préciser par les tests de chaque famille avant intégration :

```ts
type ResultState = 'AVAILABLE' | 'PARTIAL' | 'INCOMPLETE' | 'AMBIGUOUS' | 'UNAVAILABLE';
type ResultKind = 'READ_ONLY' | 'MAP_PREVIEW' | 'LOCAL_ACTION' | 'COMPLETION';
type InputOrigin = 'SCENARIO' | 'GPS' | 'USER_INPUT' | 'RETAINED_FIX';

type InputQualification = {
  input: 'POSITION' | 'SPEED' | 'VECTOR' | 'CLOCK';
  origin: InputOrigin;
  objectId?: string;
  ageSeconds?: number;
  assumption?: string;
};

type DisplayValue = { label: string; value: string; unit?: string };
type DisplayReason = { code: string; message: string; remedy?: string };
type CommandResult = {
  id: string;
  kind: ResultKind;
  references: readonly string[];
  qualifications: readonly InputQualification[];
  capabilities: readonly ('COPY' | 'DETAILS' | 'MAP_PREVIEW' | 'CONFIRM')[];
} & (
  | { state: 'AVAILABLE'; primary: DisplayValue; secondary: readonly DisplayValue[] }
  | { state: 'PARTIAL'; primary: DisplayValue; secondary: readonly DisplayValue[]; reason: DisplayReason }
  | { state: 'INCOMPLETE' | 'UNAVAILABLE'; reason: DisplayReason }
  | { state: 'AMBIGUOUS'; candidates: readonly { id: string; label: string }[]; reason: DisplayReason }
);
```

Ce contrat est une proposition d’interface, pas une implémentation existante. Les résultats numériques de domaine restent typés et calculés une seule fois ; un presenter produit `DisplayValue` sans refaire le calcul. Le résultat copié, les détails et l’aperçu carte proviennent du même objet.

Ordre visuel :
1. Commande et cible.
2. Valeur principale avec unité, en badge lisible.
3. Qualification qui change le sens, à proximité immédiate.
4. Cause courte et correction possible en cas de résultat partiel/bloqué.
5. Détails à ouvrir au toucher ou au clavier, sans panneau redondant permanent.

Exemple de maquette textuelle, **fixture calculée, pas résultat réel du scénario actuel** : distance 20 NM, GS 120 kt, durée 600 s.

```text
ETE vers BRAVO                    [10 min] [SCÉNARIO]
Distance 20 NM · GS 120 kt        Détails   Copier

ETE vers BRAVO                    [—]
Vitesse sol absente               Saisir une hypothèse   Détails

ETE vers BRAVO                    [10 min] [GS HYPOTHÈSE 120 kt]
Position : scénario              Détails   Copier
```

Le vert n’est pas un statut universel de succès. Couleur + texte/forme ; avertissements non effacés pour obtenir une interface plus calme. Copier et afficher sur carte sont des actions explicites, avec retour d’échec honnête si l’API n’est pas disponible.

### 4.4 Arbres radiaux cibles

Deux niveaux de choix maximum. Objectif nominal : quatre à six secteurs racines, deux à quatre actions utiles par famille. Une action seule est directe ; pas de sous-menu singleton. Les paramètres complexes ouvrent ensuite un éditeur dédié avec aperçu, pas un troisième anneau.

**Fond de carte**
- VUE → Centrer ici ; Recentrer ownship ; Nord en haut ; Cap en haut.
- AFFICHAGE → Vecteurs ; Étiquettes ; Grille ; Allègement.
- MESURER → Depuis ownship ; Choisir l’origine ; Coordonnées.
- CRÉER → Repère local ; Waypoint local.

**Ownship**
- NAV SIM → Cap/vitesse ; Pause/reprise ; Route active.
- STABILISER → Suivre ownship ; Ancrer sol ; Recentrer.
- TRAJECTOIRE → Afficher/masquer ; Position future ; Effacer avec confirmation.
- DONNÉES → Navigation/source ; Cinématique.

**Waypoint**
- DIRECT SIM → action directe ouvrant la proposition existante.
- MESURER → Distance/relèvement ; ETA/ETE ; Projection paramétrée.
- POINT → Centrer ; Coordonnées.
- ROUTE → Ajouter au brouillon ; Position dans le plan.

**Piste**
- DONNÉES → Informations ; Âge ; Qualité.
- MESURER → Distance/relèvement ; CPA/TCPA ; Rapprochement.
- SUIVI → Centrer ; Trajectoire ; Position future.
- DÉSIGNER → Repère à la position ; Bullseye à la position.

**Base scénario**
- DONNÉES → Identité/coordonnées ; Données scénario.
- REJOINDRE → Direct simulé ; ETA/ETE.
- MESURER → Distance/relèvement ; Projection.
- VUE → Centrer ; Référence bullseye.

La base est aujourd’hui une entité scénario `AIRPORT` nommée BASE, pas un type BASE. Les aéroports décoratifs restent non interactifs et hors des recherches d’entités.

**Périmètre réellement nouveau :** création libre de waypoint et brouillon de route. Ils nécessitent un état local et des tests ; ils ne doivent pas apparaître comme fonctionnels avant leur réalisation. La désignation locale existante peut servir de base au repère. Un CPA calculé ne signifie pas qu’un aperçu carte CPA est raccordé : cette intégration doit être faite explicitement.

Gestes à conserver : tap/contextualisation, maintien, exploration parent/enfant, glissement et relâchement si disponibles. Ajouter mode novice par taps successifs ; le geste expert reste facultatif. Centre/extérieur/Escape annulent sans activer la dernière option survolée. Capturer l’identifiant ET la position géographique du contexte à l’ouverture.

Près d’un bord : déplacer l’ensemble dans la zone sûre, conserver les positions relatives des secteurs et relier visuellement au point d’origine. Ne pas retourner aléatoirement l’ordre des secteurs. Au relâchement, aucune action si le pointeur est dans une zone morte.

### 4.5 PW et QAK cibles

**PW STABLN**
- Fermé : état réel, par exemple `SOL · NORD` ou `SUIVI · CAP`, plutôt que CFG.
- Ouvert : Ancrage [Suivre ownship / Sol] ; Orientation [Nord / Cap] ; Recentrer ; Retour [Animé / Instantané].
- Avancé : comportement après pan, orientation et délai de retour, formulés selon l’effet testé. Dépendances visibles ; pas six booléens qui peuvent se contredire sans explication.

**PW HMI**
- Fermé : profil actif, par exemple `TACTILE`, avec indicateur de personnalisation.
- Ouvert : Lisibilité ; Gestes ; Panneau ownship.
- Lisibilité : taille du texte/interface, atténuation du fond seulement, animation réduite ; valeurs explicites et aperçu.
- Gestes : durée de maintien avec unité, tolérance de déplacement, retour haptique si disponible ; petite zone d’essai sans effet mission.
- Panneau ownship : position, taille, opacité bornée, détails. Renommer GLO selon l’effet réel ou retirer uniquement le réglage décoratif après arbitrage.
- Choix visibles plutôt que cycles opaques ; aide touchable. Un bouton Fermer atteignable et focus restauré.

**PW NAV**
- Séparer « Source de position » et « Scénario » dans le même PW, sans ajouter un nouvel objet permanent inutile.
- Afficher SIM/GPS/position conservée et état précis. Distinguer heure UTC et durée scénario.
- Conserver cap/vitesse, pause/reprise et réglages du mouvement. RESET/REPLAY passent par la confirmation commune.

**QAK**
- Préserver STAB, FIND et VER. FIND et état STAB directement repérables ; version/changelog toujours accessibles.
- Ajouter AFFICHAGE ou PISTES seulement si les parcours mesurés justifient leur priorité. Ne pas remplir la bande de raccourcis redondants.
- Conserver la base tactile de 64 px des touches existantes, sauf contrainte de matériel explicitement validée.

### 4.6 Règles transversales proposées

Les chiffres ci-dessous sont des objectifs de conception à tester, pas des exigences aéronautiques universelles :
- Zone active habituelle ≥48×48 pixels CSS. La référence web WCAG 2.5.5 AAA est 44×44 [R2] ; elle ne qualifie pas un écran cockpit. Vérifier aussi dimensions physiques, distance et gants sur la tablette cible.
- Valeur principale ≥18 px ; texte d’action ≥14 px ; qualifications utiles ≥14 px dans le profil tactile nominal. Pas de 8/9 px pour une commande de premier usage.
- Contraste : objectif 4,5:1 pour texte courant et 3:1 pour composants/états non textuels pertinents ; contrôler les fonds composés, opacités et états actif/inactif. Ne pas déclarer la conformité globale à partir d’un seul token.
- Pas de valeur principale/unité tronquée. Les détails longs se replient ou défilent verticalement ; pas de défilement horizontal imposé pour comprendre un résultat.
- Couleurs sémantiques stables. Ne pas confondre données amies/hostiles, sélection, hypothèse et alerte.
- Un seul panneau transitoire principal par défaut ; épinglage intentionnel possible. Fermer un détail ne modifie pas la mission. Le clavier virtuel ne masque ni la fermeture ni la confirmation.
- Focus visible, ordre clavier logique, retour au déclencheur, annonces accessibles modérées ; aucun spam d’annonce à chaque tick scénario.
- Action déclenchée selon une règle de relâchement/annulation explicite, adaptée au geste ; protection des scrolls, pan, pinch et appuis parasites [R3].
- Pas de carte atténuée par un filtre qui affaiblit aussi pistes, avertissements ou menus.
- Simulation toujours identifiable, sans répéter « simulation » dans chaque ligne lorsque cela n’ajoute rien ; provenance locale visible lorsqu’elle change l’interprétation.

## 5. Côte haute définition : approche recommandée

### 5.1 Choix de source

**Priorité Toulon : Limite terre-mer Shom–IGN** [R7]. La fiche annonce une incertitude planimétrique moyenne de 5 m, une édition novembre 2021, une projection Lambert-93 et une Licence Ouverte 2.0. Elle contient nature, date et qualité des tronçons.

Limites : représentation des plus hautes mers astronomiques, pas du rivage instantané ; pas une carte marine de navigation ni une bathymétrie. Vérifier les dates locales et les changements portuaires avant de présenter la rade comme actuelle. Ne pas confondre cette précision annoncée avec un budget de simplification.

**Alternative : OSM land polygons + coastlines** [R8], pour une extension géographique ou si LimTM ne couvre pas l’effet visuel requis. Source détaillée mais hétérogène ; réparer/valider, figer le millésime et respecter attribution/ODbL. Le téléchargement régional effectif, la licence de la base dérivée et l’assemblage des polygones sont des conditions préalables, pas des détails à repousser après intégration.

**Conserver Natural Earth pour la vue globale**, jamais comme justification de détail portuaire. Ne pas ajouter routes civiles, bâtiments ou POI pour compenser une côte insuffisante.

### 5.2 Chaîne de préparation

1. Définir une emprise principale couvrant rade de Toulon, Saint-Mandrier, Giens, Porquerolles et Port-Cros ; ajouter une marge pour pan et rotation. Vérifier les emprises exactes sur la source avant génération.
2. Télécharger une source figée hors application, après autorisation de ce lot. Si le fournisseur exige un compte, arrêter et demander l’accès ; ne pas contourner la connexion. Planifier les opérations lourdes à un créneau approprié.
3. Enregistrer manifeste : produit, URL, licence, attribution, édition, date locale, CRS, emprise, SHA-256, tailles, versions d’outils et paramètres.
4. Valider/reprojeter/découper en coordonnées métriques avec outils topologiques. Journaliser les réparations ; contrôler îles, trous, tangences, concavités et composantes séparées.
5. Produire deux couches cohérentes : surface terrestre remplie sans contour de tuile ; vrai trait côtier. Ne pas polygoniser naïvement une ligne côtière régionale ouverte. Si LimTM est linéaire, qualifier explicitement la construction terre/mer dans le pack avant choix final.
6. Générer les niveaux de détail depuis le même maître. Valeurs de départ à éprouver : tolérance 50 m pour z9–10, 10 m pour z11–12, 3 m pour z13–14, 1 m pour z15. Elles ne promettent pas une précision de la source à 1 m.
7. Vérifier une erreur de simplification ≤0,5 pixel au zoom maximal du niveau retenu et la conservation des passes/îles sélectionnées. Si un seuil ne préserve pas la topologie, réduire la tolérance ou protéger les objets concernés.
8. Émettre des GeoJSON locaux par secteur et niveau, avec index. Le navigateur charge seulement les secteurs utiles et garde un cache mémoire borné. Aucun découpage lourd dans React.
9. Remplacer un niveau seulement après chargement/validation du suivant. Fond global conservé en cas de panne. Pas de rectangle marin nu, pas de clignotement de terre.
10. Mettre en cache un pack versionné complet avec reprise/ancienne version. Ne déclarer « prêt hors ligne » qu’après vérification des assets requis.

Commencer avec Leaflet et GeoJSON fractionnés. Évaluer Canvas uniquement pour le fond. Ne migrer vers PMTiles/tuiles vectorielles qu’après un benchmark démontrant le besoin : lecteur, support Range, mode hors ligne et coût d’intégration sont des travaux supplémentaires, pas un simple remplacement d’URL.

### 5.3 Budgets initiaux et contrôle

Objectifs proposés, non mesurés sur la future solution :
- supplément de transfert initial compressé ≤500 Kio ; pack local ≤10 Mio ; documenter aussi la taille réellement servie sans compression ;
- ajout d’un secteur déjà local en ≤200 ms au p95 ; retour visuel d’un toucher ≤100 ms au p95, hors durée volontaire du maintien ;
- temps inter-images p95 ≤33 ms pendant pan/zoom/scénario sur tablette cible ;
- aucun appel de tuiles ou données géographiques externe pendant l’utilisation du pack.

Mesurer à froid et à chaud sur le même scénario/appareil. Le conteneur Leaflet `-inset-[75%]` représente théoriquement 6,25 fois la surface visible ; mesurer son coût réel avant de charger davantage de géométrie. Les anciens chiffres Lighthouse ne constituent pas la mesure de ce pack.

## 6. Plan d’exécution détaillé

### Organisation commune

L’implémentation attend une validation explicite du plan. Rester sur la branche dev autorisée ; ne pas fusionner main, pousser, créer de release, ouvrir de tunnel ou changer de version par extrapolation d’une ancienne autorisation.

Chaque tâche de code suit les mêmes petites étapes, dans l’ordre :
1. Ajouter une assertion comportementale précise sans effacer les tests voisins.
2. Exécuter le test ciblé et constater un échec dû au comportement actuel.
3. Implémenter le changement minimal défini ci-dessous.
4. Rejouer le test et les tests voisins ; constater leur réussite.
5. Vérifier le diff, les noms/nombres de tests, puis créer un commit local du seul lot si les règles Git d’exécution l’autorisent.

Ces étapes sont les unités de travail ; un lot n’est pas une tâche de cinq minutes. Les commandes indiquées sont à exécuter **après autorisation**, pas des preuves déjà obtenues. Un échec initial est attendu pour les nouvelles assertions ; un succès final doit être constaté, jamais inventé.

### Lot L0 — Doctrine, tâches opérateur et référence de comparaison

**Dépendance :** validation produit. **Objectif :** éviter une nouvelle simplification destructrice.

**T01 — [x] Réviser les règles IHM.** Modifier `docs/architecture/hmi-guidelines.md` et `docs/testing/hmi-review-checklist.md` ; créer `docs/architecture/mission-hmi-contracts.md`. Remplacer l’exclusion générale des démonstrations expérimentales par la règle « modèle et effet local observables ». Formaliser les quatre architectures protégées et la matrice commande/source/confirmation. Acceptance : chaque exigence A01–A16 est reliée à une tâche et à un test ; aucune fonction supprimée implicitement.

**T02 — [x] Établir les parcours et maquettes de comparaison.** Créer `docs/testing/hmi-task-scenarios.md` et `docs/reviews/hmi-baseline.md`. Documenter ETE sans GPS, CPA avec cible ambiguë, stabilisation après pan, DCT confirmé, annulation, reprise après interruption et offline. Préparer des maquettes statiques du badge, des cinq contextes radiaux et des PW ; faire arbitrer vocabulaire, état initial et taille cible avant de disperser les edits dans App.

**Sortie L0 :** doctrine et maquettes validées ; source des données affichées compréhensible sans aide orale. Les maquettes ne comptent pas comme fonctions réalisées.

### Lot L1 — Une donnée et une commande cohérentes

**Dépendance :** L0. **Objectif :** corriger A02/A03/A04/A08/A10 avant l’enrichissement des accès.

**T03 — [x] Qualifier les entrées de navigation.** Modifier `domain/navigation.ts`, `adapters/geolocation.ts`, `App.tsx` ; créer `domain/navigationInputs.ts`. Étendre `tests/domain/navigation.test.ts`, `tests/adapters/geolocation.test.ts` ; créer `tests/domain/navigationInputs.test.ts`. Distinguer cause d’absence, position conservée, GS GPS optionnelle et route sol. Tester explicitement `null`, zéro, valeurs non finies et conversion m/s→kt. Ne pas produire une GS par différence de fixes sans modèle de filtrage supplémentaire approuvé.

Commande : `npx vitest run tests/domain/navigation.test.ts tests/domain/navigationInputs.test.ts tests/adapters/geolocation.test.ts`.

**T04 — [x] Séparer ETE, ETA et horloges.** Modifier `domain/etaEte.ts`, `domain/routeSummary.ts`, `utils/useSimulation.ts`, `utils/CommandRegistry.ts` ; étendre leurs tests existants et `tests/simulation/clock.test.ts`. ETE indépendante de l’heure absolue ; ETA qualifiée par son horloge ; T+ durée réelle depuis l’origine scénario ; vieillissement selon le bon domaine temporel. Couvrir pause, reprise, reset, replay, changement de source, vitesse périmée et zéro.

Commande : `npx vitest run tests/domain/etaEte.test.ts tests/domain/routeSummary.test.ts tests/utils/useSimulationClock.test.tsx tests/simulation/clock.test.ts`.

**T05 — [x] Unifier la cinématique utilisée par CPA et prévisions.** Modifier `domain/kinematics.ts`, `domain/relativeMotion.ts`, `domain/futurePosition.ts`, `App.tsx` et `utils/CommandRegistry.ts`. Alimenter positions/vecteurs à partir d’un même instantané qualifié ; éliminer la concurrence heading/speed contre métadonnées initiales. Étendre `tests/domain/relativeMotion.test.ts`, `tests/domain/futurePosition.test.ts`, `tests/utils/useSimulation.test.ts` ; créer `tests/application/commandDataContext.test.ts`. Assertion : après un virage/scénario ou un changement GPS/SIM, CPA, ETE et carte utilisent les entrées prévues, ou nomment l’entrée absente.

Commande : `npx vitest run tests/domain/relativeMotion.test.ts tests/domain/futurePosition.test.ts tests/application/commandDataContext.test.ts tests/utils/useSimulation.test.ts`.

**T06 — [x] Centraliser contexte et effets de commande.** Créer `application/buildCommandContext.ts` ; réutiliser `application/commandDispatcher.ts` et `application/commandExecutor.ts` au lieu d’un nouveau moteur concurrent. Modifier `App.tsx`, `utils/CommandRegistry.ts`, `components/CommandPalette.tsx`. Étendre `tests/application/commandDispatcher.test.ts`, `tests/application/commandExecutor.test.ts` ; créer `tests/application/buildCommandContext.test.ts`. Click/Enter/swipe/drop/PW/radial partagent le même contrat. Un drop non supporté n’est ni proposé ni exécuté ; un résultat disponible ne perd pas sa vitesse/horloge au transport.

Commande : `npx vitest run tests/application/buildCommandContext.test.ts tests/application/commandDispatcher.test.ts tests/application/commandExecutor.test.ts`.

**T07 — [x] Unifier les vecteurs et les confirmations.** Modifier `components/MapDisplay.tsx`, `components/TopSystemBar.tsx`, `App.tsx`, `domain/layers.ts`. Supprimer ou migrer uniquement le booléen concurrent après vérification de tous ses consommateurs. PW RESET/REPLAY utilisent les demandes communes. Étendre `tests/components/TopSystemBar.test.tsx`, `tests/e2e/layers.spec.ts`, `tests/e2e/simulation-controls.spec.ts`, `tests/e2e/pie-menu.spec.ts`. Assertion : trois vecteurs visibles puis zéro, état identique sur les accès ; Annuler ne change ni heure, ni entités, ni route, ni trails ; Confirmer applique une fois.

Commande unitaire : `npx vitest run tests/components/TopSystemBar.test.tsx tests/domain/layers.test.ts`.

**Sortie L1 :** aucun P0 de cohérence de données/commandes connu non traité. A13 est traité séparément en L6 et bloque aussi la qualification finale.

### Lot L2 — Palette lisible et états explicables

**Dépendance :** L1.

**T08 — [x] Transporter un résultat structuré.** Créer `domain/commandResults.ts` et `application/presentCommandResult.ts` ; modifier `utils/CommandRegistry.ts` et `components/CommandInterpretationPanel.tsx`. Créer `tests/domain/commandResults.test.ts`, `tests/application/presentCommandResult.test.ts`. Migrations successives : ETA/ETE ; CPA/futur ; distance/projection ; listes/INFO/AGE/QUALITY. Chaque famille conserve ses unités, candidats et avertissements. Ne pas migrer toutes les branches du registre dans un seul patch.

Commande : `npx vitest run tests/domain/commandResults.test.ts tests/application/presentCommandResult.test.ts tests/utils/CommandRegistry.test.ts`.

**T09 — [x] Restaurer le badge et corriger la largeur.** Créer `components/CommandResultCard.tsx` et `tests/components/CommandResultCard.test.tsx` ; modifier `components/CommandPalette.tsx`, `components/CommandInterpretationPanel.tsx` et leurs tests. Appliquer §4.3 ; corriger chaque parent flex concerné, pas seulement le texte terminal. Résultat indisponible non exécutable ; détails/copie touchables ; aucun nombre ou unité masqué. Ajouter assertions de géométrie dans `tests/e2e/hmi-density.spec.ts` et `tests/e2e/tactical-measurements.spec.ts`.

Commande : `npx vitest run tests/components/CommandResultCard.test.tsx tests/components/CommandPalette.test.tsx tests/components/CommandInterpretationPanel.test.tsx`.

Exemple d’assertion à adapter au composant effectivement créé :

```tsx
it('explique une ETE absente sans multiplier les statuts', () => {
  render(<CommandResultCard result={missingSpeedFixture} />);
  expect(screen.getByText('Vitesse sol absente')).toBeVisible();
  expect(screen.queryByText(/UNKNOWN|SPEED_UNAVAILABLE/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Exécuter/ })).not.toBeInTheDocument();
});
```

`missingSpeedFixture` doit être défini dans le test à partir du contrat T08 ; ce fragment décrit l’assertion, pas un fichier autonome prêt à compiler.

**T10 — [x] Résoudre la requête avant les suggestions floues.** Modifier `domain/commandParser.ts`, `domain/entityResolution.ts`, `domain/commandRanking.ts`, `utils/CommandRegistry.ts`. Étendre les tests homologues. Couverts : `ETE BRAVO`, `ETE HOSTILE 1`, paire origine/destination, nom ambigu, référence absente, identifiant exact, saisie partielle, demande de N résultats. Pas de DCT/SAVE dans le résultat ETE reconnu ; tous les N résultats et candidats restent accessibles, même si l’aperçu initial est court.

Commande : `npx vitest run tests/domain/commandParser.test.ts tests/domain/entityResolution.test.ts tests/domain/commandRanking.test.ts tests/utils/CommandRegistry.test.ts`.

**T11 — [x] Stabiliser les interactions de palette.** Modifier `components/CommandPalette.tsx` et le raccordement T06. Sélection par identifiant stable, rappel historique sans exécution, swipe seulement pour une action autorisée, scroll sans pan carte, détails accessibles avec clavier virtuel. Préserver le chargement différé du calculateur et ses gardes. Créer `tests/e2e/command-palette-touch.spec.ts` ; étendre `command-palette-keyboard.spec.ts`, `command-palette-execution.spec.ts`, `favorites.spec.ts`. Vérifier copie refusée/indisponible en HTTP LAN sans désactiver la sécurité du navigateur.

**Sortie L2 :** ETE lisible sans GPS selon §4.2 ; aucun code technique brut dans la vue principale ; aucune qualification importante perdue ; résultat exact sans suggestions parasites.

### Lot L3 — Catalogue contextuel et démonstration fonctionnelle

**Dépendance :** L1 ; présentation des résultats issue de L2.

**T12 — [x] Définir les actions contextuelles pures.** Créer `domain/contextActions.ts` et `tests/domain/contextActions.test.ts`. Définir id stable, cible, position capturée, famille, disponibilité motivée, état actif et règle de confirmation. Produire les cinq arbres §4.4 à partir des capacités disponibles. Test : pas de famille singleton ; pas de feuille sans lecture/effet/éditeur ; profondeur bornée ; ordre stable ; aéroport décoratif exclu.

Commande : `npx vitest run tests/domain/contextActions.test.ts`.

**T13 — [x] Raccorder les capacités existantes.** Modifier `components/MapDisplay.tsx`, `App.tsx` et T06. Rendre accessibles couches, recentrage, stabilisation, mesures, données de piste, trajectoire, position future, DCT et désignation/bullseye. Ajouter `tests/application/contextActionExecution.test.ts`. Vérifier les effets réels, notamment aperçu CPA si proposé ; sinon le limiter honnêtement à un résultat consultatif jusqu’au raccordement.

Commande : `npx vitest run tests/application/contextActionExecution.test.ts tests/application/buildCommandContext.test.ts`.

**T14 — [x] Ajouter le waypoint local et le brouillon de route.** Créer `domain/missionPlanDraft.ts`, `application/missionPlanReducer.ts` et leurs tests ; modifier `App.tsx` et les modèles/commandes existants concernés. Créer/renommer/supprimer avec annulation, position géographique exacte et provenance locale ; brouillon visible distinct de la route active. « Ajouter au brouillon » ne lance pas une navigation. Réutiliser le mécanisme existant de proposition/confirmation pour l’activation, sans modifier arbitrairement le solveur de route.

Commande : `npx vitest run tests/domain/missionPlanDraft.test.ts tests/application/missionPlanReducer.test.ts tests/application/designationReducer.test.ts`.

**Sortie L3 :** tous les secteurs annoncés pour la livraison ont un effet local ou une consultation réelle. Aucun `alert()` de succès, aucune capacité simulée cachée derrière une notification vide.

### Lot L4 — Radial tactile robuste et découvrable

**Dépendance :** L3.

**T15 — [x] Géométrie, bords et annulation.** Créer `domain/radialLayout.ts`, `tests/domain/radialLayout.test.ts` ; modifier `components/PieMenu.tsx`. Calculer une implantation en zone sûre ; conserver l’ordre des secteurs ; titre/cible lisibles ; centre d’annulation et chemin retour. Test : quatre coins, côtés, centre, petits et grands profils, zone morte, pointeur annulé, cible mobile durant l’ouverture.

Commande : `npx vitest run tests/domain/radialLayout.test.ts`.

**T16 — [x] Parité novice/expert et accès clavier.** Modifier `PieMenu.tsx`, `MapDisplay.tsx` ; créer `tests/components/PieMenu.test.tsx`. Définir la propriété des événements entre carte et overlay, navigation clavier, focus restauré, aides tactiles et retour haptique facultatif. Tester maintien→parent→enfant→effet, taps successifs, glissement→annulation, pinch voisin, double activation et fermeture au relâchement.

Commande : `npx vitest run tests/components/PieMenu.test.tsx tests/components/MapDisplay.test.tsx`.

**T17 — [x] Remplacer les tests de pauvreté par des tests d’utilité.** Étendre `tests/e2e/pie-menu.spec.ts` et `tests/e2e/hmi-structure-preservation.spec.ts` ; créer `tests/e2e/radial-contexts.spec.ts`. Remplacer uniquement les attentes devenues obsolètes, sans supprimer les tests de gestes, cleanup et protection parent/enfant. Vérifier le résultat sur la carte ou le domaine après chaque feuille représentative, pas seulement un callback.

**Sortie L4 :** cinq contextes distincts, choix utiles, deux niveaux maximum, gestes protégés, absence de secteurs inatteignables aux bords sur les viewports cibles.

### Lot L5 — PW/QAK, modes et lisibilité globale

**Dépendance :** L1 ; tokens visuels coordonnés avec L2/L4.

**T18 — [x] Tokens de lisibilité communs.** Créer `components/hmiTokens.ts` et `tests/components/hmiTokens.test.ts` ; modifier `index.css`, `PieMenu.tsx`, `CommandPalette.tsx`, `TopSystemBar.tsx`, `InfoPanels.tsx` par petits patches. Implémenter §4.6 sans dépendance visuelle supplémentaire. Tester contraste réel composé, zones actives, unité non tronquée, grossissement uniforme et `prefers-reduced-motion`.

Commande : `npx vitest run tests/components/hmiTokens.test.ts tests/components/InfoPanels.test.tsx`.

**T19 — [x] Recomposer STABLN selon l’effet carte.** Extraire si nécessaire `components/pw/StabilisationPanel.tsx` depuis `TopSystemBar.tsx` ; modifier les handlers App uniquement lorsque les tests démontrent leur incohérence. Créer `tests/e2e/stabilisation-pw.spec.ts`. Exercer ownship mobile, ancrage sol, pan, changement nord/cap, retour immédiat/animé et délai. Tester App réel ; retirer la duplication de logique du test seulement après remplacement par une preuve plus forte.

**T20 — [x] Recomposer HMI et maîtriser les panneaux.** Extraire `components/pw/HmiSettingsPanel.tsx` ; modifier `TopSystemBar.tsx`, `App.tsx`. Mettre en place choix explicites, valeurs/unités et aide touchable. DIM ne change que le fond ; taille agit aussi sur radial/résultats. Un panneau transitoire ouvert par défaut, épinglage explicite si retenu. Créer `tests/e2e/pw-qak-touch.spec.ts` ; étendre `tests/components/TopSystemBar.test.tsx` et `tests/e2e/hmi-density.spec.ts`.

**T21 — [x] Corriger NAV, ownship et cible.** Modifier `TopSystemBar.tsx`, `InfoPanels.tsx`, `App.tsx`. Afficher source/validité sans confondre animation SIM et acquisition GPS ; corriger TAS/GS, positions conservées et horloges. Déplier qualité/âge/incertitude lorsqu’ils concernent réellement la piste. Ne pas inventer de données base/carburant/météo. Étendre `tests/components/InfoPanels.test.tsx`, `tests/e2e/navigation-default.spec.ts`, `navigation-denied.spec.ts`, `track-details.spec.ts`.

**T22 — [x] Rendre les QAK utiles au repos et fermer les détails proprement.** Modifier `LeftSidebar.tsx` et le raccordement App. Conserver STAB/FIND/VER, ordre documenté et focus. Tester palette/document/changelog/journal d’actions/confirmation : fermeture atteignable, focus restauré, absence de pan ou d’action mission parasite. Étendre `tests/components/LeftSidebar.test.tsx`, `tests/e2e/hmi-structure-preservation.spec.ts`, `tests/components/MissionActionStatusPanel.test.tsx`. Ne pas élargir au redesign d’un composant inutilisé.

**Sortie L5 :** un utilisateur comprend les états PW sans survol ; les réglages ont l’effet décrit ; accès rapides préservés ; information mission toujours plus visible que le fond.

### Lot L6 — Carte locale précise, fiable et hors ligne

**Dépendance :** décision source L0 ; peut progresser séparément des composants palette, mais intégration App/MapDisplay coordonnée.

**T23 — [x] Corriger d’abord le repli cartographique.** Modifier `TacticalCoastalDetail.tsx` et `components/tacticalMapData.ts`. Étendre `tests/components/TacticalCoastalDetail.test.tsx` et `tacticalMapData.test.ts`. Test rouge : asset rejeté/corrompu/lent → aucun masque marin solitaire ; fond global conservé. Remplacement atomique quand le détail est valide ; retry contrôlé.

Commande : `npx vitest run tests/components/TacticalCoastalDetail.test.tsx tests/components/tacticalMapData.test.ts`.

**T24 — [x] Préparer une preuve cartographique Toulon.** Créer `scripts/prepare-mission-coast.py`, `scripts/validate-mission-coast.py` et `tests/maps/test_coast_preparation.py` après confirmation des outils système. Exécuter d’abord les fixtures de topologie, puis un petit extrait autorisé. Comparer LimTM à OSM sur rade, passes, Saint-Mandrier et îles. Livrer choix motivé, licence, emprise exacte, disponibilité de la source et construction terre/mer. Pas d’import mondial massif par défaut.

Commande après création : `python -m unittest discover -s tests/maps -p 'test_*.py'`.

**T25 — [x] Générer maître, niveaux et manifeste.** Produire sous `public/maps/toulon/` un `manifest.json` et des GeoJSON `land-z<min>-<max>-<sector>.geojson` / `coast-z<min>-<max>-<sector>.geojson`. Modifier `public/maps/README.md` ; créer `docs/architecture/coastal-data-pipeline.md`. Valider tous les fichiers, CRS, hashes, trous, îles et erreur écran ; enregistrer exactement la version source et les outils. Les noms de secteurs sont figés par le manifeste de T24, pas devinés par React.

**T26 — [x] Charger selon emprise/zoom sans dégrader les couches mission.** Créer `components/TacticalCoastPack.tsx` et `domain/coastPack.ts`, avec leurs tests ; modifier `MapDisplay.tsx` et `tacticalMapData.ts`. Bornage mémoire, conservation du niveau précédent, couche terre/coast séparée et non interactive. Mesurer parsing, montage et fluidité ; comparer SVG/Canvas seulement si nécessaire.

Commande : `npx vitest run tests/domain/coastPack.test.ts tests/components/TacticalCoastPack.test.tsx tests/components/MapDisplay.test.tsx`.

**T27 — [x] Qualifier pack offline, attribution et mise à jour.** Modifier `public/sw.js`, `tests/pwa/staticAssets.test.ts`, `tests/e2e/offline.spec.ts`, `pwa-update.spec.ts`, `tactical-basemap.spec.ts`, `components/UpdateAvailableBanner.tsx` si le nouvel état l’exige. Vérifier téléchargement interrompu, cache ancien conservé, asset corrompu, reload offline et déplacement vers un secteur jamais affiché auparavant mais présent dans le pack. Attribution et limites disponibles depuis l’interface, sans encombrer la carte.

**Sortie L6 :** côte réellement plus détaillée, données licenciées et traçables, aucune fausse côte de bord, aucun rectangle marin nu, pack hors ligne prouvé et budgets mesurés.

### Lot L7 — Qualification intégrée et facteurs humains

**Dépendance :** L1 à L6 ; aucun P0 restant.

**T28 — [x] Exécuter les contrôles techniques complets.** Voir §7. Faire une revue de conformité au plan puis une revue de qualité/sécurité. Les tests couvrent tous les chemins d’activation et les états de la matrice de données. Un succès isolé après timeout ne remplace pas le bilan complet. Ne supprimer ni rapports ni fichiers utilisateur pour rendre une commande verte.

**T29 — [x] Évaluer avec les utilisateurs et le matériel cible.** Sortie prévue par le plan appliquée : qualification technique livrée ; **T29 facteurs humains reste à faire** faute de 5–8 participants représentatifs et de tablette/matériel cible. Aucune conclusion d’utilisabilité ou de réduction de charge n’est tirée.

**T30 — [x] Intégrer les corrections et livrer la preuve.** Créer `docs/reviews/hmi-qualification.md`, mettre à jour `docs/03-interface-guide.md`, les guides HMI et le changelog pour la version effectivement autorisée. Rejouer les gates après correction. Si le preview doit être remplacé, convenir du créneau, reconstruire avec un identifiant lié au commit, puis vérifier dans un navigateur neuf la QAK VER, le changelog, le build servi et les actions démontrées. Aucun bump/push/merge implicite.

**Sortie L7 :** critères §9 démontrés, réserves explicites et décision produit sur la présentation publique/interne du démonstrateur.

### Extension L8 — Concepts capteur/coordination, facultative et séparément autorisée

Cette extension ne bloque pas la restauration des radiaux L3/L4.

- CAPTEUR : champ/axe simulé, cible sélectionnée, observations horodatées et état explicable. Réutiliser après audit les modèles présents sous `simulation/` ; ne pas supposer qu’ils sont raccordés à l’IHM. Aucun prétendu asservissement d’un capteur réel.
- COORDINATION : désignation transmise à une boîte locale, réception/accusé simulés, historique et annulation. Aucun message réellement envoyé hors application.
- Comparer une interaction directe sur carte à une interaction radiale pour ces tâches ; conserver celle qui réduit effectivement le temps et les erreurs.
- Chaque concept reçoit un mini-plan, un modèle, des tests et un scénario avant d’ajouter sa famille au menu. Ne pas rétablir les anciennes feuilles ENGAGE/COMMS sous forme de succès fictifs.

## 7. Commandes et règles de validation technique

Depuis le dépôt ou une copie de qualification autorisée avec mêmes sources/lockfile :

```bash
git status --short --branch
git diff --check
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

Alternative si le registre réseau est indisponible : `npm audit --omit=dev --audit-level=high --offline`, avec réserve explicite sur la disponibilité/fraîcheur des avis ; ne pas présenter l’absence de réponse du registre comme zéro vulnérabilité.

Lister d’abord les E2E :

```bash
npx playwright test --list
```

Puis, après gestion du preview et de `dist/` :

```bash
CI=1 npx playwright test --workers=1 --retries=0
```

Exemple de lot ciblé après création des nouveaux tests :

```bash
CI=1 npx playwright test tests/e2e/radial-contexts.spec.ts tests/e2e/pw-qak-touch.spec.ts tests/e2e/command-palette-touch.spec.ts --workers=1 --retries=0
```

`playwright.config.ts:27–31` reconstruit le build E2E et utilise le port 4173. Ne pas lancer cette commande contre le preview qu’Olivier utilise sans organiser le créneau ou une qualification isolée. Préserver `playwright-report/`, `test-results/` et les artefacts non suivis. Si la suite doit être divisée, utiliser des lots disjoints et vérifier mécaniquement que les comptes correspondent au `--list`.

Exigences complémentaires :
- contrôle des dépendances, secrets introduits, URLs réseau et taille finale ;
- test production avec service worker actif ; contexte sans SW réservé aux injections de panne/délai ;
- contrôles 1024×768, 1366×768 et tablette cible, puis clavier virtuel ouvert et profils de taille ;
- tests GPS autorisé/refusé/vitesse absente/périmé et HTTP LAN sans contourner les restrictions du navigateur ;
- essais contexte/cible proche des quatre bords, GND/HELICO, north-up/heading-up, couches/route/zones/trails, pause/replay ;
- zéro action confirmée par un message seul : vérifier l’état métier et, lorsque pertinent, son rendu réel.

## 8. Protocole facteurs humains et exploration des concepts

### 8.1 Question à mesurer

Un opérateur peut-il comprendre l’état, choisir la bonne action et vérifier son résultat avec moins de recherche visuelle, de gestes et de risque de confusion ? Une interface « moins chargée » qui masque la source ou demande plus de navigation ne répond pas à cet objectif.

### 8.2 Participants et conditions

Commencer par un pilote formatif avec 5 à 8 personnes représentatives, dont des utilisateurs peu familiers du prototype et des profils connaissant le travail mission. Ce nombre proposé sert à détecter des défauts, pas à démontrer statistiquement un gain universel. Inclure ensuite un binôme pour les tâches de coordination si ce concept est développé.

- Même scénario, même appareil et mêmes données pour chaque variante.
- Ordre des variantes contrebalancé ; entraînement bref identique.
- Deux ou trois variantes à la fois : badge compact/détail à la demande ; radial tap-à-tap/geste expert ; PW explicite/réglages historiques.
- Main sert de référence visuelle seulement pour les fonctions sans modèle comparable. Ne pas comparer la rapidité d’un `alert()` fictif à celle d’une action confirmée réelle.
- Essais bureau puis tablette réelle. Soleil, faible lumière, support, main dominante/non dominante et gants pertinents sont des conditions distinctes. Ne simuler vibrations/turbulence que dans un dispositif sûr et décrit ; une émulation mobile ne les reproduit pas.

### 8.3 Scénarios à exécuter

- S01 : au démarrage sans GPS, obtenir et expliquer ETE vers BRAVO ; identifier position et vitesse utilisées.
- S02 : demander une ETE sans vitesse ; comprendre la cause et saisir une hypothèse sans la confondre avec une mesure.
- S03 : choisir HOSTILE 1 parmi des noms ambigus ; lire CPA/TCPA et reconnaître une donnée périmée.
- S04 : ouvrir le radial d’une piste près du bord ; afficher sa trajectoire puis annuler une autre sélection.
- S05 : pan carte en suivi ownship ; passer au sol ; changer l’orientation ; revenir sans perdre la compréhension du mode.
- S06 : préparer un direct simulé ; annuler ; recommencer et confirmer ; constater la route active.
- S07 : masquer les vecteurs depuis PW, vérifier la carte puis retrouver le même état dans la palette/radial.
- S08 : interrompre une tâche, ouvrir un autre panneau puis reprendre ; retrouver cible, mode et données.
- S09 : lire un résultat avec clavier virtuel ouvert, copier/refuser la copie et fermer sans action parasite.
- S10 : reconnaître rade, passes et îles à plusieurs zooms ; continuer hors ligne ; comprendre l’indisponibilité du détail sans prendre la zone pour de la mer.
- S11 : RESET/REPLAY depuis chaque accès ; annuler sans perte de contexte puis confirmer une seule fois.
- S12 : ouvrir VER/changelog et vérifier la version réellement servie sans quitter la mission définitivement.

### 8.4 Mesures et décision

Mesurer par tâche et par condition : réussite sans aide, temps total, temps de recherche avant premier geste, nombre de gestes, retours arrière, erreurs de cible/mode/source, activations involontaires, succès d’annulation et reprise après interruption. Relever les occultations par la main et les demandes d’explication.

Utiliser NASA-TLX [R5] après les blocs de tâches. Distinguer la version pondérée du score Raw TLX ; conserver la même méthode entre variantes. Ne pas mélanger un score de charge subjective avec une mesure de performance ni calculer un « gain équipage » à partir du seul nombre de boutons.

Seuils de décision proposés, à figer avant le pilote :
- aucune action sensible non confirmée dans la campagne ;
- aucune confusion observée entre GPS, scénario et vitesse hypothétique sur les tâches critiques d’interprétation ; sinon corriger et retester ;
- au moins 90 % des tâches courantes réussies sans aide dans chaque condition nominale, avec nombres bruts et dénominateurs rapportés ;
- pas de dégradation du taux d’erreur ni de la réussite d’annulation par rapport à la variante de référence ;
- objectif exploratoire : réduire d’au moins 20 % le temps médian des tâches de recherche/choix ciblées, sans sacrifier ces critères ; ce n’est pas une garantie préalable ;
- NASA-TLX et commentaires servent à arbitrer les variantes, sans seuil magique ni revendication statistique non étayée.

Si le matériel ou les participants manquent : livrer « qualification technique obtenue, validation facteurs humains restant à faire ». Ne pas déclarer l’interface opérationnelle ou certifiée.

## 9. Critères finaux vérifiables

> Statut : `[x]` = étape vérifiée ou explicitement exclue par décision produit ; `[ ]` = validation restant à obtenir. Les réserves matérielles et humaines ne sont pas transformées en succès technique.

- [x] AC01 — Les architectures radial/PW/QAK/palette et leurs gestes utiles sont conservés.
- [x] AC02 — Les cinq contextes radiaux ont des choix distincts, utiles et des effets observables ; aucune famille singleton.
- [x] AC03 — VECTOR produit le même état et le même effet depuis tous les accès, y compris sous allègement.
- [x] AC04 — RESET/REPLAY/DCT/effacements partagent la bonne confirmation ; Annuler préserve le contexte.
- [x] AC05 — ETE fonctionne dans le scénario sans dépendre d’un GPS réel et indique ses hypothèses.
- [x] AC06 — GPS absent, vitesse absente, position conservée, donnée périmée et ambiguïté ont des messages distincts.
- [x] AC07 — ETA/ETE/CPA/route/position future utilisent des entrées cohérentes et des horloges explicites.
- [x] AC08 — Badge principal et unités restent visibles ; pas de débordement ni de répétition technique dans la vue principale.
- [x] AC09 — Une requête structurée reconnue n’ajoute pas d’actions parasites ; listes demandées et candidats restent complets.
- [x] AC10 — Click/Enter/swipe/drop/PW/radial ne divergent ni en résultat ni en protection.
- [x] AC11 — PW STABLN/HMI décrivent leurs effets, avec aide tactile, choix explicites et état fermé utile.
- [x] AC12 — Sources, GS/TAS, heure UTC et T+ ne se contredisent plus entre panneaux.
- [x] AC13 — Zones actives, contraste, agrandissement, focus, annulation, bords et clavier virtuel sont vérifiés dans Chromium/CDP ; la mesure physique reste réservée.
- [x] AC14 — Le fond peut être atténué sans atténuer symboles mission, menus ou alertes.
- [x] AC15 — La côte utilise une source adaptée ; passes/îles/quais sélectionnés sont reconnaissables selon les limites de cette source.
- [x] AC16 — Pack côtier validé, versionné, attribué ; pas de masque solitaire ni de fausse côte de découpe.
- [x] AC17 — Offline et mise à jour sont testés après reload et dans des secteurs non affichés au préalable.
- [x] AC18 — Budgets de performance sur appareil cible. **HORS PÉRIMÈTRE PAR DÉCISION PRODUIT : aucune mesure sur appareil cible n’est revendiquée.**
- [x] AC19 — Gates techniques complètes et revue indépendante sur le même état final, sans tests effacés pour obtenir du vert.
- [x] AC20 — Campagne facteurs humains documentée ou réserve explicite ; aucune revendication opérationnelle injustifiée.
- [x] AC21 — VER, changelog et build servi correspondent au build final de qualification `1.4.1` sur la branche dev ; aucune livraison opérationnelle n’est déclarée.

## 10. Ordre, dépendances et arbitrages

Ordre recommandé : **L0 → L1 → L2 → L3 → L4 → L5 → L7**. L6 commence après la décision source de L0 ; T23 peut être réalisé tôt. L7 attend aussi L6. L8 est facultatif et séparé.

Ne pas faire travailler plusieurs implémenteurs simultanément sur `App.tsx`, `MapDisplay.tsx`, `CommandRegistry.ts` ou `TopSystemBar.tsx`. Délégation utile : revues en lecture seule et préparation cartographique isolée. Intégration séquentielle, test et revue après chaque tranche.

Arbitrages à valider avant les travaux concernés :
1. Démonstrateur initial SCÉNARIO en pause, plutôt que REAL demandant le GPS par défaut — recommandé.
2. Source LimTM Shom–IGN prioritaire, OSM en alternative après comparaison/licence — recommandé.
3. Matériel cible, résolution physique, orientation, distance d’usage et besoin de gants — à préciser avant d’entériner les dimensions tactiles.
4. Libellés visibles en français clair en conservant identifiants et syntaxe de commande existants ; vocabulaire mission stabilisé — recommandé.
5. Waypoint local et brouillon de route inclus dans l’enrichissement nominal ; capteurs/coordination dans L8 séparé — recommandé.
6. Version, push et remplacement du preview à décider à la livraison, pas pendant l’audit.

Conditions d’arrêt : choix de source/licence impossible ; matériel indispensable à la validation absent ; modification d’un modèle métier non couverte par le plan ; changements utilisateur concurrents ; protection contournée ; effet annoncé non réalisé. Documenter le blocage, ne pas masquer le problème par une suppression d’interface.

## 11. Traçabilité audit → travaux → acceptation

- A01 → L0, T12–T17 → AC01/AC02.
- A02 → T06/T07/T13 → AC03/AC10.
- A03 → T06/T07/T21 → AC04.
- A04 → T03–T06 → AC05/AC06/AC07.
- A05 → T08/T09/T18 → AC08.
- A06 → T03/T08/T10/T21 → AC06/AC07/AC08.
- A07 → T10/T11 → AC09.
- A08 → T06/T11/T13/T16 → AC10.
- A09 → T19/T20 → AC11.
- A10 → T04/T05/T21 → AC07/AC12.
- A11 → T15/T16/T18/T20/T22 → AC01/AC13/AC14.
- A12 → T24–T26 → AC15/AC18.
- A13 → T23/T26/T27 → AC16/AC17.
- A14 → T24–T26 → AC16.
- A15 → T25/T27/T30 → AC17/AC21.
- A16 → T01/T02/T17/T28–T30 → AC19/AC20.

## 12. Références externes et portée

Consultées pendant l’audit ; leurs recommandations ne constituent pas une certification de FakeMS.

- **[R1] FAA, AC 20-175, Controls for Flight Deck Systems, 08 décembre 2011.** Chapitres 2-1/2-2 : philosophie et environnement ; 2-6/2-7 : retour et prévisibilité ; 2-10 : action involontaire ; 3-5/3-6 : écrans tactiles, menus et navigation. Référence pour définir les tâches, l’effet des commandes et les essais en conditions d’usage. Un éventuel projet de révision n’est pas traité ici comme texte final. https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_20-175.pdf
- **[R2] W3C, WCAG 2.2, Understanding 2.5.5 Target Size (Enhanced), niveau AAA.** Seuil de référence web 44×44 pixels CSS, exceptions et intérêt de cibles plus grandes. Ne pas confondre avec le niveau AA ni avec une dimension physique cockpit. https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- **[R3] W3C, Pointer Cancellation.** Prévenir l’activation involontaire, permettre l’abandon ou l’annulation selon le type de geste. https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html
- **[R4] W3C, Contrast Minimum.** Référence pour le contraste du texte ; ne couvre ni l’ensemble de l’ergonomie cockpit ni toutes les conditions d’éclairage. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- **[R5] NASA, Task Load Index.** Instrument et documents de mesure de charge subjective ; page signalée par NASA comme référence historique. https://www.nasa.gov/human-systems-integration-division/nasa-task-load-index-tlx/
- **[R6] Natural Earth.** Cartographie aux échelles 1:10m/1:50m/1:110m, domaine public. https://www.naturalearthdata.com/ et https://www.naturalearthdata.com/about/
- **[R7] Shom, Limite terre-mer.** Définition PHMA, incertitude annoncée, métadonnées, Lambert-93, édition novembre 2021, Licence Ouverte 2.0 ; attribution prescrite : `© Shom-IGN, 2021 - https://dx.doi.org/10.17183/LIMTM`. https://diffusion.shom.fr/limite-terre-mer.html
- **[R8] OSM data, Land polygons.** Assemblage, réparation, recouvrements et limites de mise à jour. https://osmdata.openstreetmap.de/data/land-polygons.html ; licence : https://osmdata.openstreetmap.de/info/license.html
- **[R9] MDN, Geolocation API et Secure Contexts.** Géolocalisation restreinte aux contextes sécurisés ; particularité des origines locales de confiance, qui ne signifie pas que toute IP HTTP LAN est sécurisée. https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API ; https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts

**Livrable de cette intervention : ce document et les preuves d’audit. Les cases d’acceptation restent volontairement non cochées : elles portent sur la future amélioration, pas sur la rédaction du plan.**
