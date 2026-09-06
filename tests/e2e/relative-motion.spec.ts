import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('shows closure and CPA as local relative-motion calculations', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  const interpretation = page.getByTestId('command-interpretation');
  await input.fill('CLOSURE HOSTILE 1');

  await expect(interpretation).toContainText('COMMAND: CLOSURE');
  await expect(interpretation).toContainText('EFFECT: CALCULATION ONLY');
  await expect(interpretation).toContainText('ASSUMPTION: CONSTANT VELOCITY');
  await expect(interpretation).toContainText('CLOSURE:');
  await expect(page.getByRole('option', { name: /^CLOSURE HOSTILE 1 ·/i })).toBeVisible();

  await page.getByRole('option', { name: /^CLOSURE HOSTILE 1 ·/i }).click();
  await expect(page.getByRole('dialog', { name: 'Tactical command palette' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Route proposal' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);

  await input.fill('CPA BRAVO');
  await expect(interpretation).toContainText('COMMAND: CPA');
  await expect(interpretation).toContainText('CPA:');
  await expect(interpretation).toContainText('TCPA:');
  await expect(interpretation).toContainText('STATUS:');
  await expect(page.getByRole('option', { name: /^CPA BRAVO ·/i })).toBeVisible();
});
