import { expect, test } from '@playwright/test';

test('registers a build-scoped PWA and exposes an explicit update contract', async ({ page }) => {
  await page.goto('/');

  const pwaState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const script = await fetch(`${new URL('./sw.js', window.location.href)}`).then(response => response.text());
    const buildId = script.match(/const BUILD_ID = '([^']+)'/)?.[1];
    if (!buildId) throw new Error('Served service worker has no build marker');
    const activeCacheName = `fake-ms-shell-${buildId}`;
    const shellCache = await caches.open(activeCacheName);
    const cachedUrls = (await shellCache.keys()).map(request => new URL(request.url).pathname);
    const cacheKeys = await caches.keys();
    const basemapCached = Boolean(await shellCache.match(new URL('./maps/ne_110m_land.geojson', window.location.href).href));
    const airportsCached = Boolean(await shellCache.match(new URL('./maps/ne_10m_airports_major.geojson', window.location.href).href));
    const coastalPackCached = await Promise.all([
      './maps/toulon/manifest.json',
      './maps/toulon/coast-west.geojson',
      './maps/toulon/coast-east.geojson',
    ].map(path => shellCache.match(new URL(path, window.location.href).href).then(Boolean)));
    const mapAssetsCached = cachedUrls.some(url => /\/assets\/MapDisplay-[^/]+\.js$/.test(url))
      && cachedUrls.some(url => /\/assets\/MapDisplay-[^/]+\.css$/.test(url))
      && cachedUrls.some(url => /\/assets\/legend-[^/]+\.js$/.test(url));
    const obsoleteCacheKeys = cacheKeys.filter(key => (
      key.startsWith('fake-ms-tiles-')
      || key.startsWith('fake-ms-tile-meta-')
      || (key.startsWith('fake-ms-shell-') && key !== activeCacheName)
    ));
    return {
      scope: registration.scope,
      controller: Boolean(navigator.serviceWorker.controller),
      buildId,
      activeCacheName,
      cacheKeys,
      basemapCached,
      airportsCached,
      coastalPackCached,
      mapAssetsCached,
      obsoleteCacheKeys,
      script,
    };
  });

  expect(pwaState.scope).toContain('/FakeMS/');
  expect(pwaState.controller).toBe(true);
  expect(pwaState.buildId).not.toBe('__FAKEMS_BUILD_ID__');
  expect(pwaState.cacheKeys).toContain(pwaState.activeCacheName);
  expect(pwaState.cacheKeys.filter(key => key.startsWith('fake-ms-shell-'))).toEqual([pwaState.activeCacheName]);
  expect(pwaState.obsoleteCacheKeys).toEqual([]);
  expect(pwaState.basemapCached).toBe(true);
  expect(pwaState.airportsCached).toBe(true);
  expect(pwaState.coastalPackCached).toEqual([true, true, true]);
  expect(pwaState.mapAssetsCached).toBe(true);
  expect(pwaState.script).toContain('maps/ne_110m_land.geojson');
  expect(pwaState.script).toContain('maps/ne_10m_airports_major.geojson');
  expect(pwaState.script).toContain('maps/toulon/manifest.json');
  expect(pwaState.script).toContain('maps/toulon/coast-west.geojson');
  expect(pwaState.script).toContain('maps/toulon/coast-east.geojson');
  expect(pwaState.script).toContain("type === 'SKIP_WAITING'");
  await expect(page.getByRole('button', { name: 'Apply update and reload' })).toHaveCount(0);
  await expect(page.getByText('MAP DATA & LIMITATIONS', { exact: true })).toBeVisible();
  await page.getByText('MAP DATA & LIMITATIONS', { exact: true }).click();
  await expect(page.getByText('© OpenStreetMap contributors · ODbL-1.0.', { exact: true })).toBeVisible();
  await expect(page.getByText(/not a certified navigation chart/i)).toBeVisible();
});
