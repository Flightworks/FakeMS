import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('controls a local latitude/longitude grid without external map data', async ({ page }) => {
  await page.goto('/');
  await page.locator('.leaflet-container').waitFor({ state: 'visible' });
  await expect(page.locator('.latlon-grid-line')).toHaveCount(0);

  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Command input' });

  await input.fill('GRID LATLON ON');
  const enable = page.getByRole('option', { name: /GRID LATLON ON/i }).filter({ hasText: 'LOCAL GRID' });
  await expect(enable).toContainText('STEP 1MIN');
  await enable.click();
  const initialGridLineCount = await page.locator('.latlon-grid-line').count();
  expect(initialGridLineCount).toBeGreaterThan(0);

  await page.keyboard.press('Control+k');
  await input.fill('GRID LATLON STEP 1MIN');
  const step = page.getByRole('option', { name: /GRID LATLON STEP 1MIN/i }).filter({ hasText: 'VALIDATED' });
  await expect(step).toBeVisible();
  await step.click();
  expect(await page.locator('.latlon-grid-line').count()).toBeGreaterThan(0);

  await page.keyboard.press('Control+k');
  await input.fill('GRID MGRS ON');
  await expect(page.getByRole('option', { name: /GRID UNAVAILABLE/i })).toContainText('MGRS');
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);
});
