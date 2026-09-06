import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('controls only the local rendered tactical layers', async ({ page }) => {
  await page.goto('/');
  await page.locator('.leaflet-container').waitFor({ state: 'visible' });
  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Command input' });

  await input.fill('LAYERS');
  const initial = page.getByRole('option', { name: /LAYERS/i }).filter({ hasText: 'LOCAL ONLY' });
  await expect(initial).toContainText('TRACKS ON');
  await expect(initial).toContainText('VECTORS ON');
  await expect(initial).toContainText('ROUTE ON');

  await input.fill('LAYER TRACKS OFF');
  await page.getByRole('option', { name: /LAYER TRACKS OFF · VISIBLE → HIDDEN/i }).click();
  await page.keyboard.press('Control+k');
  await input.fill('LAYERS');
  await expect(page.getByRole('option', { name: /LAYERS/i }).filter({ hasText: 'LOCAL ONLY' })).toContainText('TRACKS OFF');

  await input.fill('LAYER VECTORS OFF');
  await page.getByRole('option', { name: /LAYER VECTORS OFF · VISIBLE → HIDDEN/i }).click();
  await page.keyboard.press('Control+k');
  await input.fill('LAYERS');
  await expect(page.getByRole('option', { name: /LAYERS/i }).filter({ hasText: 'LOCAL ONLY' })).toContainText('VECTORS OFF');

  await input.fill('LAYER GRID ON');
  await expect(page.getByRole('option', { name: /LAYER UNAVAILABLE/i })).toContainText('NO STATE CREATED');
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);
});
