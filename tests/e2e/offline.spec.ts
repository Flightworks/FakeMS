import { expect, test } from '@playwright/test';

test('reloads the cached simulation shell when the network is offline', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.getByText('SIMULATION', { exact: true })).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.tactical-basemap-land path:not([d="M0 0"])').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.tactical-airport-point:not([d="M0 0"])').first()).toBeVisible({ timeout: 30_000 });
  const coastPack = page.locator('.tactical-coast-pack').first();
  await expect(coastPack).toHaveAttribute('data-coast-state', 'loaded', { timeout: 30_000 });
  const initialCoastSectorIds = await coastPack.getAttribute('data-coast-sector-ids');

  const hasServiceWorker = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  test.skip(!hasServiceWorker, 'Service workers are unavailable in this browser context');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('SIMULATION', { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
    });
  });
  await expect(page.locator('.tactical-basemap-land path:not([d="M0 0"])').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.tactical-airport-point:not([d="M0 0"])').first()).toBeVisible({ timeout: 30_000 });

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('SIMULATION', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('body')).toContainText('NOT FOR OPERATIONAL USE', { timeout: 30_000 });
  await expect(page.locator('.tactical-basemap-land path:not([d="M0 0"])').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.tactical-airport-point:not([d="M0 0"])').first()).toBeVisible({ timeout: 30_000 });
  await expect(coastPack).toHaveAttribute('data-coast-state', 'loaded', { timeout: 30_000 });
  await expect(coastPack).not.toHaveAttribute('data-coast-mask');
  const cachedCoastPack = await page.evaluate(async () => Promise.all([
    './maps/toulon/manifest.json',
    './maps/toulon/coast-west.geojson',
    './maps/toulon/coast-east.geojson',
  ].map(path => caches.match(new URL(path, window.location.href).href).then(Boolean))));
  expect(cachedCoastPack).toEqual([true, true, true]);

  const missionMarkerCount = await page.locator('.custom-entity-icon').count();
  const vectorCount = await page.locator('.kinematic-vector-line').count();
  expect(missionMarkerCount).toBeGreaterThan(0);
  expect(vectorCount).toBeGreaterThan(0);

  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill('TRAIL HOSTILE 1 ON');
  await page.getByRole('option', { name: /TRAIL HOSTILE 1 ON/i }).filter({ hasText: 'HISTORICAL ONLY' }).click();
  await expect(page.locator('.track-trail-layer path')).toHaveCount(1);
  const trailCount = await page.locator('.track-trail-layer path').count();
  await page.keyboard.press('Escape');

  const nav = page.getByRole('button').filter({ hasText: /^NAV/ }).first();
  await expect(nav).toBeVisible({ timeout: 30_000 });
  await nav.click();
  const simulationToolbox = page.getByRole('region', { name: 'Simulation toolbox' });
  await expect(simulationToolbox).toBeVisible({ timeout: 30_000 });
  await simulationToolbox.getByRole('button', { name: 'SIM', exact: true }).click();
  await page.waitForTimeout(2_500);

  await page.keyboard.press('Control+k');
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill('DCT G01');
  await page.getByRole('option', { name: /DCT G01.*Direct To/i }).first().click();
  const directTo = page.getByRole('dialog', { name: 'Direct-to route proposal status' });
  await directTo.getByRole('button', { name: 'Accept route proposal' }).click();
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close direct-to route proposal' }).click();
  await simulationToolbox.getByRole('button', { name: 'Close panel' }).click();
  const routeCount = await page.locator('.leaflet-simulatedRouteLayer-pane path').count();
  const zoomBeforeFreshSector = Number(await coastPack.getAttribute('data-coast-zoom'));
  await page.locator('.leaflet-container').dispatchEvent('wheel', {
    deltaY: -1_000,
    deltaX: 0,
    clientX: 800,
    clientY: 300,
    bubbles: true,
  });
  await expect.poll(async () => Number(await coastPack.getAttribute('data-coast-zoom')), { timeout: 15_000 })
    .toBeGreaterThan(zoomBeforeFreshSector);
  const mapRoot = page.locator('.absolute.inset-0.bg-slate-950').first();
  const panWest = async (pointerId: number) => {
    await mapRoot.dispatchEvent('pointerdown', {
      pointerId,
      pointerType: 'mouse',
      clientX: 100,
      clientY: 384,
      bubbles: true,
    });
    for (const clientX of [900, 1_700, 2_500, 3_000]) {
      await mapRoot.dispatchEvent('pointermove', {
        pointerId,
        pointerType: 'mouse',
        clientX,
        clientY: 384,
        bubbles: true,
      });
    }
    await mapRoot.dispatchEvent('pointerup', {
      pointerId,
      pointerType: 'mouse',
      clientX: 3_000,
      clientY: 384,
      bubbles: true,
    });
  };
  for (const pointerId of [91, 92, 93]) {
    await panWest(pointerId);
    await page.waitForTimeout(250);
    if (await coastPack.getAttribute('data-coast-sector-ids') === 'coast-west') break;
  }
  await expect.poll(async () => coastPack.getAttribute('data-coast-sector-ids'), { timeout: 30_000 })
    .toBe('coast-west');
  expect(await coastPack.getAttribute('data-coast-sector-ids')).not.toBe(initialCoastSectorIds);
  await expect(coastPack).toHaveAttribute('data-coast-state', 'loaded');
  await expect(coastPack).not.toHaveAttribute('data-coast-mask');
  await expect(page.locator('.custom-entity-icon')).toHaveCount(missionMarkerCount);
  expect(await page.locator('.kinematic-vector-line').count()).toBeGreaterThanOrEqual(vectorCount);
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(routeCount);
  await expect(page.locator('.track-trail-layer path')).toHaveCount(trailCount);
});
