import { expect, test } from '@playwright/test';

test('reloads the cached simulation shell when the network is offline', async ({ page, context }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByText('SIMULATION', { exact: true })).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.tactical-basemap-land path:not([d="M0 0"])').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.tactical-airport-point:not([d="M0 0"])').first()).toBeVisible({ timeout: 30_000 });

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
});
