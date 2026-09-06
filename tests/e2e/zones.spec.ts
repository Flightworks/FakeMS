import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('lists and checks only local named zones', async ({ page }) => {
  await page.goto('/');
  await page.locator('.leaflet-container').waitFor({ state: 'visible' });
  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Command input' });

  await input.fill('ZONE LIST');
  const list = page.getByRole('option', { name: /ZONE LIST/i }).filter({ hasText: 'LOCAL ONLY' });
  await expect(list).toContainText('TRAINING-A');
  await expect(list).toContainText('TRAINING-CIRCLE');
  await expect(list).toContainText('TRAINING-POLYGON');

  await input.fill('ZONE SHOW TRAINING-A');
  const show = page.getByRole('option', { name: /ZONE SHOW TRAINING-A/i }).filter({ hasText: 'RECTANGLE' });
  await expect(show).toContainText('LOCAL SCENARIO');
  await show.click();
  await expect(page.locator('.named-zone-layer path')).toHaveCount(1);

  await page.keyboard.press('Control+k');
  await input.fill('ZONE CHECK OWNSHIP TRAINING-A');
  await expect(page.getByRole('option', { name: /ZONE CHECK VIPER 1-1 TRAINING-A/i })).toContainText('RESULT: INSIDE');

  await input.fill('ZONE SHOW UNKNOWN');
  await expect(page.getByRole('option', { name: /ZONE UNAVAILABLE/i })).toContainText('UNKNOWN LOCAL ZONE');
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);
});
