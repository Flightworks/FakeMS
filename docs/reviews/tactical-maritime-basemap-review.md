# Revue du fond de carte tactique maritime

## Verdict

**PASS pour la V1 du plan.** Le fond est local, sombre, simplifié et séparé des couches mission. Les réserves visuelles portent sur la congestion de certains symboles mission existants, pas sur le fond cartographique.

## Build et captures

- Branche : `dev/mission-simulation-foundation`
- Commits de la fonctionnalité :
  - `62eb5c7a56ac18e030bf87d3002866b43a624000`
  - `05e328b0487bde008bb40c4c3193036e0ae06bf9`
- Preview qualifié : `http://127.0.0.1:4173/FakeMS/`
- Captures temporaires hors dépôt :
  - `/tmp/fakems-visual-main-1024.png`
  - `/tmp/fakems-visual-main-1366.png`
  - `/tmp/fakems-visual-base-airports-1024.png`
  - `/tmp/fakems-visual-mission-overlays-1024.png`
  - `/tmp/fakems-visual-radial-menu-1024.png`
  - `/tmp/fakems-visual-offline-1024.png`

Les captures ne sont pas ajoutées au dépôt afin de préserver les artefacts et de ne pas versionner des sorties de qualification lourdes.

## Revue visuelle

### Vue principale — 1024×768

- mer uniforme `#090d12` ;
- terres gris foncé ;
- trait de côte fin et moins lumineux que les objets mission ;
- 3 chemins terrestres rendus ;
- 1 repère aéroportuaire statique ;
- 6 entités mission visibles ;
- aucune tuile Leaflet externe.

La mer est volontairement presque noire conformément à la palette du plan. Aucun relief, route, bâtiment, nom de ville ou POI civil n’est visible.

### Vue principale — 1366×768

La même hiérarchie est conservée sur la largeur supérieure. Les couches mission restent plus contrastées que le fond et aucun détail civil supplémentaire n’apparaît.

### Vue avec `BASE` et aéroport statique

`BASE` reste une entité FakeMS distincte. Le repère statique est rendu dans son propre pane et ne possède ni libellé, ni sélection, ni action mission.

### Vue avec trail et grille

- trails rendus : `1` ;
- lignes de grille rendues : `42` ;
- les symboles mission restent au-dessus du fond ;
- la grille et le trail restent visibles sans remplacer les objets mission.

Une congestion visuelle existe au centre du scénario entre plusieurs symboles et libellés. Elle relève du scénario et des règles de déclutter existantes ; elle n’a pas été modifiée dans cette tranche.

### Menu radial

Le menu radial s’ouvre sur la mer par appui long et reste visible au-dessus des couches cartographiques. Le parcours réel est couvert par `pie-menu.spec.ts`.

### Vue hors ligne

Après chargement en ligne puis rechargement réseau coupé :

- 3 chemins terrestres rendus ;
- 1 aéroport rendu ;
- aucune tuile blanche ;
- bannière de simulation conservée.

## Réseau local

Contrôle navigateur avec service worker bloqué :

```text
Local requests:
  /FakeMS/maps/ne_110m_land.geojson       1
  /FakeMS/maps/ne_10m_airports_major.geojson 1
OpenStreetMap/CARTO requests: 0
Rendered land paths: 3
Rendered airport points: 1
Rendered external tiles: 0
```

Contrôle PWA : les deux GeoJSON et les chunks dynamiques `MapDisplay`, CSS et `legend` sont présents dans le cache versionné.

## Données et provenance

- `ne_110m_land.geojson` : 127 features, 138160 octets, SHA-256 `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`.
- `ne_10m_airports_major.geojson` : 66 features, 11774 octets, SHA-256 `bd673722b55fa147d7952cc34b97a2639976b5ee43f20a43d076db9b1470525f`.
- Propriétés aéroport conservées : `name`, `iata_code`, `gps_code`, `scalerank`.
- Source : Natural Earth, révision `789c9904087846cc3361302857aa2e76b0ae71ff`.

## Performance

Rapport Lighthouse desktop sur la build finale :

```text
Performance score: 94/100
Total Blocking Time: 150 ms
First Contentful Paint: 428 ms
Largest Contentful Paint: 997 ms
Transfer size: 233701 bytes
```

Les seuils du plan sont respectés : score `>= 80` et TBT `< 300 ms`. Les données GeoJSON restent des assets statiques et ne sont pas intégrées dans un nouveau chunk JavaScript.

## Qualification fonctionnelle

- Vitest : `75 fichiers, 459 tests passés`.
- E2E : `62 tests` listés et `62/62` passés en quatre lots séquentiels `19 + 19 + 17 + 7`.
- PWA/hors-ligne après durcissement du cache : `2/2`.
- Typecheck : OK.
- Build production : OK.
- Audit npm hors ligne : `0 vulnérabilité`.
- `npm run check` : OK, sans erreur ; le dépôt conserve des avertissements ESLint non bloquants historiques.
