import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('shows track details and stale ordering without mission effects', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  const interpretation = page.getByTestId('command-interpretation');
  await input.fill('INFO HOSTILE 1');
  await expect(interpretation).toContainText('COMMAND: INFO');
  await expect(interpretation).toContainText('SOURCE: RADAR');
  await expect(interpretation).toContainText('FRESHNESS: FRESH');
  await expect(interpretation).toContainText('QUALITY: GOOD');
  await expect(interpretation).toContainText('UNCERTAINTY: 40 M');
  await expect(interpretation).toContainText('CLASSIFICATION: HOSTILE');
  await expect(interpretation).toContainText('CONFIDENCE: 90%');
  await expect(page.getByRole('option', { name: /^INFO HOSTILE 1 ·/i })).toBeVisible();

  await input.fill('AGE HOSTILE 1');
  await expect(interpretation).toContainText('COMMAND: AGE');
  await expect(interpretation).toContainText('AGE: 4 S');

  await input.fill('QUALITY HOSTILE 1');
  await expect(interpretation).toContainText('COMMAND: QUALITY');
  await expect(interpretation).toContainText('QUALITY: GOOD');

  await input.fill('STALE');
  await expect(interpretation).toContainText('COMMAND: STALE');
  await expect(interpretation).toContainText('COUNT: 1');
  await expect(interpretation).toContainText('HOSTILE 2 AGE: 90 S');
  await expect(page.getByRole('dialog', { name: 'Route proposal' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);
});
