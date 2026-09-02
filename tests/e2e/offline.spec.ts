import { expect, test } from '@playwright/test';

test('reloads the cached simulation shell when the network is offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText('SIMULATION', { exact: true })).toBeVisible();

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

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('SIMULATION', { exact: true })).toBeVisible();
  await expect(page.getByText('NOT FOR OPERATIONAL USE', { exact: true })).toBeVisible();
});
