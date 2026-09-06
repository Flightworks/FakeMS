import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('creates and cancels a scenario timer without automatic action', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('TIMER 1MIN CHECK BRAVO');
  const create = page.getByRole('option', { name: /^TIMER \+1MIN ·/i });
  await expect(create).toBeVisible();
  await create.click();

  const timers = page.getByRole('status', { name: 'Scenario timers' });
  await expect(timers).toBeVisible();
  await expect(timers).toContainText('CHECK BRAVO');
  await expect(timers).toContainText('ACTIVE');
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await input.fill('CANCEL TIMER 1');
  const cancel = page.getByRole('option', { name: /^CANCEL TIMER 1 ·/i });
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(timers).toContainText('CANCELLED');
});
