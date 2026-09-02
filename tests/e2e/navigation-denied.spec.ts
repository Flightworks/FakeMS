import { expect, test } from '@playwright/test';

test('represents a denied GPS permission without promoting SIM data to real', async ({ page, context }) => {
  await context.clearPermissions();
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('NAV REAL');
  await page.getByRole('option', { name: /NAV: REAL \(GPS\)/ }).first().evaluate((element) => (element as HTMLElement).click());

  await expect(page.getByRole('button', { name: /NAV GPS DENIED/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('SIMULATION', { exact: true })).toBeVisible();
});
