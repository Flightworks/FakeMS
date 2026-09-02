import { expect, test } from '@playwright/test';

test('keeps the simulation boundary visible on the tablet viewport', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('SIMULATION', { exact: true })).toBeVisible();
  await expect(page.getByText('NOT FOR OPERATIONAL USE', { exact: true })).toBeVisible();
});
