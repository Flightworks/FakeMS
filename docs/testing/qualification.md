# Qualification FakeMS

## Pré-requis

Node.js et npm doivent être installés. Les tests unitaires utilisent Vitest/jsdom. Les essais navigateur utilisent Playwright/Chromium.

## Contrôles locaux

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm audit --omit=dev --audit-level=high
npm run build
```

`npm run check` regroupe le typecheck, le lint et les tests unitaires. Les tests Playwright restent séparés avec `npm run test:e2e`.

## Cible navigateur

La configuration Playwright utilise Chromium sur une viewport de `1024×768`.

Les parcours vérifiés sont :

- bannière de simulation permanente ;
- refus GPS ;
- palette au clavier ;
- distinction `FOCUS` / `DCT` ;
- autorisation explicite d'une proposition ;
- appui long et menu radial ;
- pause, reset et replay de la simulation ;
- shell hors ligne ;
- enregistrement PWA et cache versionné.

## Critères de sécurité

- aucune clé ou variable secrète dans `dist/` ;
- aucun `alert()` pour simuler une réussite ;
- aucune action vide dans le registre ;
- aucun effet `COMPLETED_SIM` sans exécuteur simulé réussi ;
- aucune modification ou fusion automatique vers `main`.

## Mesure Lighthouse de référence

La mesure de référence de cette phase utilise Lighthouse 13.4.1 dans les mêmes dimensions que Playwright : `1024×768`, profil desktop, CPU sans ralentissement artificiel, réseau local simulé à 40 ms / 10 Mbps.

Résultat mesuré sur la build finale :

```text
Performance : 87
Accessibilité : 100
Bonnes pratiques : 100
SEO : 91
TBT : 222 ms
LCP : 0,7 s
FCP : 0,3 s
```

Les seuils de la phase sont donc atteints dans cette condition de référence : accessibilité ≥ 95, performance ≥ 80 et TBT < 300 ms.

Le profil Lighthouse mobile standard (412×823, ralentissement CPU ×4 et réseau limité) est conservé comme mesure exploratoire plus sévère. Il obtient des résultats inférieurs et ne constitue pas la condition d’acceptation de cette interface tablette locale ; aucune valeur mobile n’est présentée comme un seuil atteint.

Les contrôles accessibles utilisent des noms explicites, des rôles de dialogue/listbox et des boutons activables au clavier. Le zoom navigateur reste autorisé.