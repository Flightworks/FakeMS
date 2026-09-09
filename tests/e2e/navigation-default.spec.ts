import { expect, test } from '@playwright/test';

test('uses real GPS navigation by default when permission is granted', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4173' });
  await context.setGeolocation({ latitude: 43.2965, longitude: 5.3698, accuracy: 12 });
  await page.goto('/');

  await expect(page.getByRole('button', { name: /NAV GPS OK/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-map-origin="43.2965,5.3698"]')).toBeVisible();
});
