# Données du fond tactique maritime

Ces fichiers sont des ressources statiques locales utilisées par FakeMS. Ils ne sont pas téléchargés au fonctionnement et ne constituent pas une carte de navigation certifiée.

## Source

- Jeu de données : Natural Earth Vector
- Révision : `789c9904087846cc3361302857aa2e76b0ae71ff`
- Licence : domaine public selon les conditions Natural Earth
- Mention recommandée : `Made with Natural Earth`
- Récupération : `2026-09-09T05:26:16Z`
- Conditions : https://www.naturalearthdata.com/about/terms-of-use/

## Terre et trait de côte

Le fond global reste volontairement léger. Une couche locale détaillée remplace son rendu autour de Toulon afin de garder un trait de côte lisible sans charger la géométrie 1:10m du monde entier.

### Fond global

Fichier local : `ne_110m_land.geojson`

Source :

```text
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/789c9904087846cc3361302857aa2e76b0ae71ff/geojson/ne_110m_land.geojson
```

- Type : `FeatureCollection`
- Échelle : `1:110m`
- Features : `127`
- Taille : `138160` octets
- SHA-256 : `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`

### Détail côtier Toulon

Fichier local : `ne_10m_land_toulon.geojson`

Source : le même `ne_10m_land.geojson` Natural Earth, découpé par `scripts/prepare-toulon-coastal-detail.mjs`.

- Échelle source : `1:10m` ;
- zone de découpe : longitude `0` à `14`, latitude `38` à `47` ;
- Features : `8` ;
- Sommets : `3334` ;
- Taille : `71576` octets ;
- SHA-256 : `93aadf2f5e9fb9fd71d384e455e2485d62082e6a3b52a7ced75bb9ae9ffec87b`.

Le rendu masque d’abord la forme 1:110m dans cette zone, puis applique les polygones 1:10m. Les limites de découpe restent au-delà de la vue nominale autour de Toulon.

### Pack côtier OSM Toulon (prototype hors ligne)

Le pack local `toulon/` contient des lignes de côte OpenStreetMap préparées par
`scripts/prepare-mission-coast.py` et contrôlées par
`scripts/validate-mission-coast.py`. Il est destiné au prototype visuel local
et pourra être consommé par la couche côtière de FakeMS sans requête réseau.

- zone source et validation : longitude `4.8` à `6.5`, latitude `42.8` à `43.5` ;
- requête Overpass :
  `[out:json][timeout:60];way["natural"="coastline"](42.8,4.8,43.5,6.5);out geom;` ;
- récupération enregistrée : `2026-09-12T19:09:16Z` (métadonnée du fichier source) ;
- source : `https://overpass-api.de/api/interpreter` ;
- licence : ODbL-1.0 ; attribution : `© OpenStreetMap contributors` ;
- source filtrée : `620` ways `natural=coastline` ;
- sortie : `622` features `LineString`, `59444` sommets, `1406486` octets ;
- projection : WGS84 ; aucune propriété civile ni libellé n’est copié dans les features.

Les secteurs stables sont :

| Fichier | Secteur | Features | Sommets | Taille | SHA-256 |
| --- | --- | ---: | ---: | ---: | --- |
| `toulon/coast-west.geojson` | `4.8`–`5.65` E | 316 | 30592 | 723577 | `6b61edbad26bedb075a965b373dd1d0e49416f9b4f2d57ea102e8c933cc2509f` |
| `toulon/coast-east.geojson` | `5.65`–`6.5` E | 306 | 28852 | 682909 | `60933fa6cbb81d0a35d6d94ff267c1a0d5cbb39059bad30ce84bdec368d7fa9d` |

Les ways ouverts restent ouverts et sont toujours des `LineString` ; aucun
polygone de terre n’est fabriqué à partir de lignes potentiellement
discontinues. La surface de terre mondiale Natural Earth
(`ne_110m_land.geojson`) reste donc le repli de remplissage.

Ce jeu OSM n’est pas un levé hydrographique : il n’est pas de qualité
topographique garantie, dépend de mises à jour communautaires hétérogènes et
ne constitue pas une carte de navigation certifiée. Le produit SHOM LimTM
reste une source potentielle pour une acquisition configurée ultérieure ; son
endpoint WFS/WMS demande une ressource ou un jeton (réponse HTTP 401 observée)
et son téléchargement passe par une commande configurable. Aucun identifiant
ou contournement d’accès n’est utilisé ici.

## Aéroports majeurs

Source complète :

```text
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/789c9904087846cc3361302857aa2e76b0ae71ff/geojson/ne_10m_airports.geojson
```

Le fichier intégré est un sous-ensemble produit par `scripts/prepare-tactical-airports.mjs` :

- `scalerank <= 2`, plus Marseille-Provence (`MRS`) comme repère régional visible depuis Toulon ;
- code IATA ou code GPS requis ;
- coordonnées finies ;
- propriétés conservées : `name`, `iata_code`, `gps_code`, `scalerank` ;
- aucun libellé, URL ou métadonnée multilingue rendu par la carte.

Fichier local : `ne_10m_airports_major.geojson`

- Type : `FeatureCollection`
- Features : `66`
- Taille : `11774` octets
- SHA-256 : `bd673722b55fa147d7952cc34b97a2639976b5ee43f20a43d076db9b1470525f`

Les aéroports statiques sont des repères cartographiques non interactifs. Ils ne sont pas ajoutés aux entités FakeMS, aux pistes ou aux résultats de commande. L’aéroport de scénario `BASE` reste géré séparément par FakeMS.
