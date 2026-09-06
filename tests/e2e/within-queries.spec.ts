import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('lists local within results with metadata and honest empty or ambiguous states', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('WITHIN 1000NM TYPE TRACK');
  const hostile = page.getByRole('option', { name: /HOSTILE 1 ·/i });
  await expect(hostile).toBeVisible();
  await expect(hostile).toContainText('RNG');
  await expect(hostile).toContainText('FRESHNESS');
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);

  await input.fill('WITHIN 1NM TYPE AIRPORT');
  await expect(page.getByRole('option', { name: /WITHIN 1NM: NONE/i })).toBeVisible();

  await input.fill('WITHIN HOSTILE 5NM');
  await expect(page.getByRole('option', { name: /WITHIN AMBIGUOUS/i })).toBeVisible();
});
