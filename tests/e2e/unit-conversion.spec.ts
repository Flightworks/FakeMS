import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('shows explicit unit conversions and rejects incompatible dimensions', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  const interpretation = page.getByTestId('command-interpretation');

  await input.fill('5NM>KM');
  await expect(page.getByRole('option', { name: /^5 NM > KM ·/i })).toBeVisible();
  await expect(interpretation).toContainText('COMMAND: CONVERT');
  await expect(interpretation).toContainText('VALUE: 9.260 KM');
  await expect(interpretation).toContainText('DIMENSION: DISTANCE');
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);

  await input.fill('5 NAUTICAL MILES > KM');
  await expect(page.getByRole('option', { name: /^5 NM > KM ·/i })).toBeVisible();
  await expect(interpretation).toContainText('VALUE: 9.260 KM');

  await input.fill('5NM > KT');
  await expect(page.getByRole('option', { name: /UNAVAILABLE/i })).toBeVisible();
  await expect(interpretation).toContainText('INCOMPATIBLE UNITS');
  await expect(interpretation).toContainText('CALCULATION NOT EXECUTED');
});
