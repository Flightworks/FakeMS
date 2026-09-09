import { expect, test } from '@playwright/test';

test('registers a build-scoped PWA and exposes an explicit update contract', async ({ page }) => {
  await page.goto('/');

  const pwaState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const cacheKeys = await caches.keys();
    const shellCache = await caches.open('fake-ms-shell-e2e');
    const cachedUrls = (await shellCache.keys()).map(request => new URL(request.url).pathname);
    const basemapCached = Boolean(await shellCache.match(new URL('./maps/ne_110m_land.geojson', window.location.href).href));
    const airportsCached = Boolean(await shellCache.match(new URL('./maps/ne_10m_airports_major.geojson', window.location.href).href));
    const mapAssetsCached = cachedUrls.some(url => /\/assets\/MapDisplay-[^/]+\.js$/.test(url))
      && cachedUrls.some(url => /\/assets\/MapDisplay-[^/]+\.css$/.test(url))
      && cachedUrls.some(url => /\/assets\/legend-[^/]+\.js$/.test(url));
    const script = await fetch(`${new URL('./sw.js', window.location.href)}`).then(response => response.text());
    return {
      scope: registration.scope,
      controller: Boolean(navigator.serviceWorker.controller),
      cacheKeys,
      basemapCached,
      airportsCached,
      mapAssetsCached,
      script,
    };
  });

  expect(pwaState.scope).toContain('/FakeMS/');
  expect(pwaState.controller).toBe(true);
  expect(pwaState.cacheKeys).toContain('fake-ms-shell-e2e');
  expect(pwaState.basemapCached).toBe(true);
  expect(pwaState.airportsCached).toBe(true);
  expect(pwaState.mapAssetsCached).toBe(true);
  expect(pwaState.script).toContain('maps/ne_110m_land.geojson');
  expect(pwaState.script).toContain('maps/ne_10m_airports_major.geojson');
  expect(pwaState.script).toContain("type === 'SKIP_WAITING'");
  await expect(page.getByRole('button', { name: 'Apply update and reload' })).toHaveCount(0);
});
