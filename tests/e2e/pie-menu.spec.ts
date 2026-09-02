import { expect, test } from '@playwright/test';

test('opens the radial menu after a long press', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  await page.mouse.move(700, 400);
  await page.mouse.down();
  await expect(page.getByRole('dialog', { name: 'MAP ACTION radial menu' })).toBeVisible({ timeout: 5_000 });
  await page.mouse.up();
});
