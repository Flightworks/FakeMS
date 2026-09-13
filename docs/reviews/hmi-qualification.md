# Qualification IHM FakeMS — T30

## Décision et portée

Cette fiche formalise la **qualification technique obtenue** pour le périmètre IHM, calculs locaux, carte côtière et shell PWA observé après T30. Le build final de qualification a été reconstruit et vérifié dans un navigateur neuf ; il ne constitue pas une publication opérationnelle. La version autorisée est **1.4.1** ; aucun bump supplémentaire n’est effectué par T30.

La décision est volontairement limitée :

- **technique :** les contrats vérifiables par code, DOM, navigateur et tests automatisés sont documentés avec leurs preuves ;
- **facteurs humains :** **T29 reste à faire faute de 5–8 participants représentatifs et de tablette/matériel cible** ;
- **opérationnel :** FakeMS ne revendique pas une qualification opérationnelle, une certification cockpit ou une aptitude à l’emploi réel.

Les objectifs `48 × 48 px CSS`, `14 px`, `18 px` et les cibles de contraste sont des objectifs techniques du démonstrateur dans les conditions de test. Ils ne remplacent pas une mesure de taille physique, de distance de visée, de lumière, de vibrations, de gants ou de clavier virtuel sur le matériel cible.

## Méthode d’audit

L’audit a été conduit sur `/tmp/fakems-audit`, branche `dev/mission-simulation-foundation`, en conservant les changements T01–T30 et les artefacts Playwright existants. La méthode a été la suivante :

1. lire le guide d’interface, les principes IHM, la check-list, les scénarios S01–S12, la frontière simulation/réel et le pipeline côtier ;
2. transformer AC01–AC21 en invariants observables et rattacher chaque invariant à une preuve nommée ;
3. comparer les parcours radial, PW, QAK et palette, puis vérifier les effets métier locaux plutôt que les seuls messages ;
4. vérifier les contrats DOM/CSS dans Chromium/CDP et les parcours E2E ;
5. vérifier les unités, calculs, états, confirmations, données côtières et service worker par les suites unitaires, DOM, Python et PWA ;
6. distinguer les lots E2E réellement exécutés d’une commande globale qui n’a pas terminé dans la fenêtre disponible ;
7. inspecter les documents modifiés et leur diff, puis contrôler les liens Markdown, les espaces d’erreur Git et l’absence de secrets.

Aucune capture d’écran, observation physique, mesure utilisateur ou résultat de campagne facteurs humains n’est utilisée comme preuve dans cette fiche.

## Preuves disponibles

Les identifiants suivants sont utilisés dans les matrices. Ils décrivent des preuves techniques, pas des résultats d’utilisabilité auprès d’opérateurs.

| ID | Preuve et portée |
| --- | --- |
| **P-DOC** | [Scénarios de tâches S01–S12](../testing/hmi-task-scenarios.md), [principes IHM](../architecture/hmi-guidelines.md), [check-list de revue](../testing/hmi-review-checklist.md) et [guide d’interface](../03-interface-guide.md). |
| **P-UNIT** | Suite Vitest complète : **93 fichiers, 653 tests passés**. Elle inclut les contrats domaine, application, composants/jsdom et PWA, notamment [etaEte](../../tests/domain/etaEte.test.ts), [entityResolution](../../tests/domain/entityResolution.test.ts), [radialLayout](../../tests/domain/radialLayout.test.ts), [contextActionExecution](../../tests/application/contextActionExecution.test.ts), [CommandResultCard](../../tests/components/CommandResultCard.test.tsx) et [staticAssets](../../tests/pwa/staticAssets.test.ts). |
| **P-E2E** | Liste mécanique de **103 tests dans 42 fichiers**. Lots disjoints finaux, aperçu réutilisé, `workers=1`, `retries=0` : A **25/25**, B **30/30**, C1 **20/20**, C2 **12/12**, D **16/16**, soit **103/103**. La commande globale unique a dépassé la fenêtre de l’outil à 420 s et n’est **pas** présentée comme passée. Exemples : [tactical-measurements](../../tests/e2e/tactical-measurements.spec.ts), [radial-contexts](../../tests/e2e/radial-contexts.spec.ts), [layers](../../tests/e2e/layers.spec.ts), [hmi-density](../../tests/e2e/hmi-density.spec.ts), [command-palette-touch](../../tests/e2e/command-palette-touch.spec.ts), [stabilisation-pw](../../tests/e2e/stabilisation-pw.spec.ts), [offline](../../tests/e2e/offline.spec.ts), [pwa-update](../../tests/e2e/pwa-update.spec.ts) et [tactical-basemap](../../tests/e2e/tactical-basemap.spec.ts). |
| **P-DOM** | Qualification navigateur Chromium/CDP, DOM et CSS aux viewports `1024 × 768` et `1366 × 768` dans les E2E concernés. Cette preuve couvre les rôles, focus, débordements, tailles CSS, ancrages radiaux et états rendus dans le navigateur testé ; elle ne mesure pas la taille physique ni l’ergonomie sur tablette. |
| **P-PWA** | T27 puis build final : cache build-scoped observé `fake-ms-shell-dev-1.4.1-qual-final`, manifest et secteurs `coast-west`/`coast-east` précachés, scope `/FakeMS/`, contrôleur actif, vue hors ligne fraîche, cache précédent protégé par le harnais et 0 requête externe ; E2E offline/PWA-update/tactical-basemap passés. |
| **P-MAP** | Pack OSM/ODbL validé avec `valid:true` et tests Python des cartes **5/5**. Le pack observé contient les secteurs `coast-west` et `coast-east`, **622 LineString**, **59 444 sommets** et environ **1 406 486 octets**, dans la bbox WGS84 `[4.8, 42.8, 6.5, 43.5]`. Référence : [pipeline côtier](../architecture/coastal-data-pipeline.md). |
| **P-GATES** | T28 puis T30 : typecheck passé ; lint canonique avec **0 erreur et 64 avertissements** connus, préexistants ou non bloquants ; build final passé avec avertissements Browserslist/chunks ; `npm audit --omit=dev --audit-level=high` avec `found 0 vulnerabilities`. |
| **P-VERSION** | `package.json` est en `1.4.1` et [CHANGELOG.md](../../CHANGELOG.md) contient l’entrée `[1.4.1]`. Dans un navigateur neuf, QAK `VER` affiche `V1.4.1` et le changelog T30 ; le marqueur DOM caché `BUILD dev-1.4.1-qual-final`, le scope `/FakeMS/` et le cache actif portent le même build ID. |
| **P-T29** | Réserve facteurs humains : aucun groupe de 5–8 participants représentatifs, aucune tablette ou matériel cible, et aucune condition physique de gants, lumière ou vibrations disponible pour cet audit. |

## Mapping AC01–AC21 vers les preuves

Le statut ci-dessous est un statut de preuve **technique**. « Couvert » ne signifie ni ergonomie démontrée ni qualification opérationnelle.

| Critère | Preuves associées | Statut et réserve |
| --- | --- | --- |
| **AC01** Architectures radial/PW/QAK/palette et gestes utiles conservés | P-E2E : [hmi-structure-preservation](../../tests/e2e/hmi-structure-preservation.spec.ts), [pie-menu](../../tests/e2e/pie-menu.spec.ts), clavier ; P-UNIT : composants `LeftSidebar`, `PieMenu`, registre | **Couvert techniquement** ; aucun jugement de facilité d’usage. |
| **AC02** Cinq contextes radiaux, choix distincts et effets observables | P-E2E : [radial-contexts](../../tests/e2e/radial-contexts.spec.ts), [pie-menu](../../tests/e2e/pie-menu.spec.ts) ; P-UNIT : `contextActions`, `radialLayout` | **Couvert techniquement** dans les contextes et feuilles testés. |
| **AC03** `VECTOR` cohérent depuis tous les accès, y compris sous allègement | P-E2E : [layers](../../tests/e2e/layers.spec.ts), [radial-contexts](../../tests/e2e/radial-contexts.spec.ts), [pw-qak-touch](../../tests/e2e/pw-qak-touch.spec.ts) ; P-UNIT : `layers`, composants de carte | **Couvert techniquement** pour l’état local et son rendu observé. |
| **AC04** Confirmations et annulation de RESET/REPLAY/DCT/effacements | P-E2E : [simulation-controls](../../tests/e2e/simulation-controls.spec.ts), [route-visibility](../../tests/e2e/route-visibility.spec.ts), [track-trails](../../tests/e2e/track-trails.spec.ts), [command-palette-tactical](../../tests/e2e/command-palette-tactical.spec.ts) ; P-UNIT : dispatcher, exécuteur, reducer et actions de contexte | **Couvert techniquement** ; les effets restent locaux et simulés. |
| **AC05** ETE dans le scénario sans GPS et hypothèses explicites | P-E2E : [tactical-measurements](../../tests/e2e/tactical-measurements.spec.ts), [navigation-denied](../../tests/e2e/navigation-denied.spec.ts) ; P-UNIT : `etaEte`, géolocalisation, entrées de navigation | **Couvert techniquement** dans la fixture scénario. |
| **AC06** Distinction GPS absent, vitesse absente, position conservée, périmé et ambiguïté | P-E2E : [navigation-denied](../../tests/e2e/navigation-denied.spec.ts), [tactical-measurements](../../tests/e2e/tactical-measurements.spec.ts), [entity-resolution](../../tests/e2e/entity-resolution.spec.ts), [track-details](../../tests/e2e/track-details.spec.ts) ; P-UNIT : géolocalisation, résolution et détails piste | **Couvert techniquement** par les états et messages testés. |
| **AC07** Cohérence des entrées et horloges pour ETA/ETE/CPA/route/position future | P-E2E : [tactical-measurements](../../tests/e2e/tactical-measurements.spec.ts), [relative-motion](../../tests/e2e/relative-motion.spec.ts), [future-position](../../tests/e2e/future-position.spec.ts), [simulation-speed](../../tests/e2e/simulation-speed.spec.ts) ; P-UNIT : calculs domaine et horloge scénario | **Couvert techniquement** pour les calculs locaux vérifiés. |
| **AC08** Badge, unités, absence de débordement et de répétition | P-DOM : [hmi-density](../../tests/e2e/hmi-density.spec.ts), [command-palette-keyboard](../../tests/e2e/command-palette-keyboard.spec.ts), [command-palette-touch](../../tests/e2e/command-palette-touch.spec.ts) ; P-UNIT : `CommandResultCard`, panneaux d’interprétation | **Couvert techniquement** dans les deux viewports ; pas une preuve physique. |
| **AC09** Pas d’actions parasites ; listes et candidats complets | P-E2E : [hmi-density](../../tests/e2e/hmi-density.spec.ts), [entity-resolution](../../tests/e2e/entity-resolution.spec.ts), [within-queries](../../tests/e2e/within-queries.spec.ts), [command-palette](../../tests/e2e/command-palette.spec.ts) ; P-UNIT : parser, classement, résolution | **Couvert techniquement** pour les requêtes et ambiguïtés couvertes. |
| **AC10** Click/Enter/swipe/drop/PW/radial cohérents | P-E2E : [command-palette-keyboard](../../tests/e2e/command-palette-keyboard.spec.ts), [command-palette-execution](../../tests/e2e/command-palette-execution.spec.ts), [command-palette-touch](../../tests/e2e/command-palette-touch.spec.ts), [radial-contexts](../../tests/e2e/radial-contexts.spec.ts), [hmi-structure-preservation](../../tests/e2e/hmi-structure-preservation.spec.ts) ; P-UNIT : registre et actions | **Couvert techniquement** sur les gestes déclarés exécutables. |
| **AC11** PW STABLN/HMI, aide tactile, choix explicites et état fermé | P-E2E : [stabilisation-pw](../../tests/e2e/stabilisation-pw.spec.ts), [pw-qak-touch](../../tests/e2e/pw-qak-touch.spec.ts) ; P-DOM : `hmi-density`, composants sidebar | **Couvert techniquement** ; la facilité tactile reste T29. |
| **AC12** Sources, GS/TAS, UTC et T+ non contradictoires | P-E2E : [tactical-measurements](../../tests/e2e/tactical-measurements.spec.ts), [simulation-speed](../../tests/e2e/simulation-speed.spec.ts), [scenario-timers](../../tests/e2e/scenario-timers.spec.ts) ; P-UNIT : calculs et horloge | **Couvert sur les contrats testés** ; pas de validation en conditions opérationnelles. |
| **AC13** Zones, contraste, agrandissement, focus, annulation, bords et clavier virtuel | P-DOM : [command-palette-touch](../../tests/e2e/command-palette-touch.spec.ts), [command-palette-keyboard](../../tests/e2e/command-palette-keyboard.spec.ts), [radial-contexts](../../tests/e2e/radial-contexts.spec.ts), [hmi-density](../../tests/e2e/hmi-density.spec.ts) ; P-UNIT : tokens et composants | **Partiel technique** : les contrats DOM/CSS sont vérifiés, pas la taille physique, lumière, gants, vibrations ni tablette cible. |
| **AC14** Atténuation du fond sans atténuer les symboles mission, menus ou alertes | P-E2E : [pw-qak-touch](../../tests/e2e/pw-qak-touch.spec.ts), [layers](../../tests/e2e/layers.spec.ts) ; P-UNIT : couches et carte | **Couvert techniquement** pour les styles et états rendus. |
| **AC15** Côte issue d’une source adaptée et reconnaissance selon les limites | P-MAP : [pipeline côtier](../architecture/coastal-data-pipeline.md) ; P-E2E : [tactical-basemap](../../tests/e2e/tactical-basemap.spec.ts) ; P-UNIT : côte et détail côtier | **Couvert pour un prototype visuel local** ; OSM n’est ni survey-grade ni une carte de navigation, et n’est pas SHOM/IGN. |
| **AC16** Pack validé, versionné, attribué, sans masque solitaire ni fausse découpe | P-MAP : manifest, validateur et [tests Python](../../tests/maps/test_coast_preparation.py) ; P-UNIT : `coastPack` ; P-E2E : [tactical-basemap](../../tests/e2e/tactical-basemap.spec.ts) | **Couvert techniquement** dans la bbox et les assets validés ; limites ODbL/OSM conservées. |
| **AC17** Offline et mise à jour après reload et secteur non déjà affiché | P-PWA : observations T27 et build final ; P-E2E : [offline](../../tests/e2e/offline.spec.ts), [pwa-update](../../tests/e2e/pwa-update.spec.ts), [tactical-basemap](../../tests/e2e/tactical-basemap.spec.ts) | **Couvert techniquement** dans Chromium/CDP et le preview testé ; aucune requête externe observée. |
| **AC18** Budgets de performance sur l’appareil cible | Aucun appareil cible ou mesure physique n’est disponible ; P-GATES ne remplace pas cette mesure. | **Hors périmètre par décision produit** ; aucune mesure sur appareil cible ni ancien score Lighthouse n’est présenté comme preuve finale. |
| **AC19** Gates techniques complètes et revue sur le même état sans supprimer de tests | P-UNIT, P-E2E, P-GATES et inspection du diff T28/T30 ; lots E2E disjoints vérifiés sans effacement de tests | **Couvert techniquement** pour l’état final audité ; les avertissements connus restent signalés. |
| **AC20** Campagne facteurs humains ou réserve explicite, sans revendication opérationnelle | P-T29 et cette fiche ; [protocole S01–S12](../testing/hmi-task-scenarios.md) | **Réserve explicite — T29 reste à faire** faute de 5–8 participants représentatifs et de tablette/matériel cible. |
| **AC21** VER, changelog et build servi concordants après autorisation de livraison | P-VERSION ; [hmi-structure-preservation](../../tests/e2e/hmi-structure-preservation.spec.ts) couvre l’accès à VER et le changelog ; package en `1.4.1` | **Couvert techniquement** dans un navigateur neuf avec le build final identifié ; aucune livraison opérationnelle n’est revendiquée. |

## Couverture technique des scénarios S01–S12

La couverture ci-dessous signifie que des invariants du scénario sont exercés par E2E, DOM ou tests unitaires. Elle ne signifie pas qu’un opérateur a réussi la tâche sans aide. Les mesures `R`, `T`, `T recherche`, `G`, erreurs, annulations, reprises, occultations, demandes d’aide et NASA-TLX ne sont pas renseignées ici.

| Scénario | E2E / navigateur | DOM / unités | Portée constatée |
| --- | --- | --- | --- |
| **S01** ETE vers BRAVO sans GPS | `tactical-measurements.spec.ts`, `navigation-denied.spec.ts` | `etaEte.test.ts`, `geolocation.test.ts`, `CommandResultCard.test.tsx` | ETE scénario, source et refus GPS ; pas de mesure utilisateur. |
| **S02** ETE sans vitesse puis hypothèse | `tactical-measurements.spec.ts` | `etaEte.test.ts`, `navigationInputs.test.ts`, `CommandResultCard.test.tsx` | Absence de GS et hypothèse explicite séparées. |
| **S03** CPA ambiguë et périmée | `entity-resolution.spec.ts`, `track-details.spec.ts`, `relative-motion.spec.ts`, `tactical-measurements.spec.ts` | `entityResolution.test.ts`, `relativeMotion.test.ts`, `trackDetails.test.ts` | Choix explicite, CPA/âge et absence d’exécution implicite. |
| **S04** Radial près d’un bord | `radial-contexts.spec.ts`, `pie-menu.spec.ts`, `hmi-structure-preservation.spec.ts` | `radialLayout.test.ts`, `contextActions.test.ts`, `PieMenu.test.tsx`, `MapDisplay.test.tsx` | Contextes, ancrages, annulation et feuilles exécutables. |
| **S05** Stabilisation après pan | `stabilisation-pw.spec.ts`, `pinch-zoom.spec.ts` | `stabilisation.test.ts`, `navigation.test.ts`, `useSimulation.test.ts` | Effets de stabilisation, orientation et retour ownship. |
| **S06** Direct simulé confirmé puis annulé | `command-palette-tactical.spec.ts`, `radial-contexts.spec.ts`, `route-visibility.spec.ts`, `command-palette.spec.ts` | `contextActionExecution.test.ts`, `missionPlanReducer.test.ts`, `routeSummary.test.ts` | Prévisualisation, annulation, confirmation et route locale. |
| **S07** Vecteurs par PW, palette et radial | `layers.spec.ts`, `radial-contexts.spec.ts`, `pw-qak-touch.spec.ts` | `layers.test.ts`, `MapDisplay.test.tsx`, `tacticalMapData.test.ts` | Même état de couche et rendu local. |
| **S08** Reprise après interruption | `command-palette-keyboard.spec.ts`, `command-palette-touch.spec.ts`, `hmi-structure-preservation.spec.ts` | `commandHistory.test.ts`, `CommandRegistry.test.ts`, `CommandPalette.test.tsx`, `LeftSidebar.test.tsx` | Sélection, focus, fermeture et reprise technique ; pas d’observation d’utilisateur. |
| **S09** Palette avec clavier virtuel | `command-palette-touch.spec.ts`, `command-palette-keyboard.spec.ts` | `CommandPalette.test.tsx`, `CommandResultCard.test.tsx`, `hmiTokens.test.ts` | Résultat, fermeture, focus et refus honnête de copie HTTP LAN ; pas de clavier physique/virtuel cible. |
| **S10** Côte, zooms et repli hors ligne | `tactical-basemap.spec.ts`, `offline.spec.ts`, `pwa-update.spec.ts` | `TacticalCoastPack.test.tsx`, `TacticalCoastalDetail.test.tsx`, `coastPack.test.ts`, `coastalDetail.test.ts`, [tests Python](../../tests/maps/test_coast_preparation.py) | Pack local, fallback et absence d’appel externe dans les conditions T27. |
| **S11** RESET/REPLAY depuis chaque accès | `simulation-controls.spec.ts`, `command-palette-tactical.spec.ts`, `track-trails.spec.ts`, `route-visibility.spec.ts` | `commandDispatcher.test.ts`, `commandExecutor.test.ts`, `contextActionExecution.test.ts`, `missionPlanReducer.test.ts` | Confirmation commune et absence de mutation à l’annulation. |
| **S12** VER, changelog et retour mission | `hmi-structure-preservation.spec.ts`, `pwa-update.spec.ts` | `LeftSidebar.test.tsx`, `staticAssets.test.ts` | Accès VER, changelog, focus de retour et marqueur de build ; contrôle final du build servi encore à faire. |

## Limites du pack côtier OSM/ODbL

Le pack est une couche de lisibilité locale, pas une donnée de navigation :

- source OSM sous ODbL, avec attribution `© OpenStreetMap contributors` conservée dans le manifest ;
- bbox WGS84 `[4.8, 42.8, 6.5, 43.5]` autour de Toulon, secteurs `coast-west` et `coast-east` ;
- 622 `LineString`, 59 444 sommets et environ 1 406 486 octets dans l’état audité ;
- couverture communautaire et mise à jour hétérogènes ; données non survey-grade ;
- aucune bathymétrie, profondeur, danger, chenal, aide à la navigation ou garantie de fermeture/topologie ;
- le pack ne doit pas être présenté comme SHOM, IGN ou une carte de navigation certifiée ; Natural Earth reste le repli de surface globale.

Le validateur vérifie la structure, WGS84, la bbox, les coordonnées, les comptes, les octets et les empreintes annoncées. Cela valide le pack logiciel dans son contrat ; cela ne valide pas sa suffisance nautique ou opérationnelle.

## Limites PWA et navigateur

La preuve PWA est limitée à Chromium/CDP et au preview utilisé pour T27/T28. Elle établit que le shell et les assets côtiers déclarés peuvent être précachés et que la vue hors ligne testée conserve les marqueurs, vecteurs, routes et trails sans requête externe. Elle n’établit pas :

- la continuité de service sur toute tablette, tout navigateur ou tout stockage disponible ;
- la disponibilité d’un cache après éviction, quota saturé ou mise à jour interrompue sur un appareil réel ;
- la validité d’une donnée cartographique hors du pack et de sa bbox ;
- une capacité GPS, réseau, capteur ou commande externe en mode opérationnel ;
- une certification de l’installation, de la mise à jour ou de la reprise après panne sur le matériel cible.

La mise à jour reste explicite : annonce, envoi de `SKIP_WAITING`, puis rechargement demandé par l’opérateur. Une indisponibilité de détail doit rester visible et ne pas être remplacée par une côte inventée.

## Réserves et décision finale

T29 facteurs humains reste à faire. Il manque **5–8 participants représentatifs** et la **tablette/matériel cible** ; il n’y a donc aucun taux de réussite, temps total, temps de recherche, nombre de gestes, NASA-TLX, résultat d’essai avec gants, résultat en lumière ou vibrations, capture d’écran ou observation physique à rapporter. Ces valeurs ne sont ni estimées ni extrapolées des tests automatisés.

La décision T30 est donc : **qualification technique obtenue, validation facteurs humains restant à faire**. La décision de ne pas revendiquer une qualification opérationnelle est maintenue. La version autorisée est `1.4.1`, sans bump supplémentaire. Le build servi vérifié est `dev-1.4.1-qual-final`; QAK `VER`, changelog, scope PWA et cache actif concordent dans un navigateur neuf. Ce build reste un artefact de qualification sur la branche dev, pas une livraison opérationnelle.
