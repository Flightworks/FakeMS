import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('preserves the permanent widgets and quick access keys', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: /NAV/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /STABLN CFG/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /HMI CFG/ })).toBeVisible();

  await page.getByRole('button', { name: 'Toggle tactical menu' }).click();
  await expect(page.getByRole('button', { name: 'STAB', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'VER' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'FIND' })).toBeVisible();
});

test('keeps the radial menu available on the map', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });

  await page.mouse.move(700, 400);
  await page.mouse.down();
  const radial = page.getByRole('dialog', { name: 'MAP ACTION radial menu' });
  await expect(radial).toBeVisible({ timeout: 5_000 });
  await page.mouse.up();
});
