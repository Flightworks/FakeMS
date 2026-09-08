import { expect, test } from '@playwright/test';

test.describe('angular tactical calculations', () => {
  test('shows reciprocal, delta, and relative bearing as local calculations', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');

    const input = page.getByRole('textbox', { name: 'Command input' });
    const interpretation = page.getByTestId('command-interpretation');

    await input.fill('RECIP 273');
    await expect(interpretation).toContainText('COMMAND: RECIP');
    await expect(interpretation).toContainText('RESULT: 093°');
    await expect(interpretation).toContainText('EFFECT: CALCULATION ONLY');

    await input.fill('DELTA 350 010');
    await expect(interpretation).toContainText('COMMAND: DELTA');
    await expect(interpretation).toContainText('DIRECTION: RIGHT');
    await expect(interpretation).toContainText('DELTA: 20°');

    await input.fill('REL BRAVO');
    await expect(interpretation).toContainText('COMMAND: REL');
    await expect(interpretation).toContainText('OUTPUT: RELATIVE_BEARING');
    await expect(interpretation).not.toContainText('UNAVAILABLE');

    await input.fill('REL G01 BRAVO');
    await expect(interpretation).toContainText('COMMAND: REL');
    await expect(interpretation).toContainText('RESULT: UNAVAILABLE');
  });

  test('does not create a mission action for angular calculations', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');

    const input = page.getByRole('textbox', { name: 'Command input' });
    await input.fill('RECIP 273');
    const interpretation = page.getByTestId('command-interpretation');
    await expect(interpretation).not.toContainText('STATUS: SIMULATED');
    await expect(interpretation).toContainText('EFFECT: CALCULATION ONLY');
    await expect(interpretation).not.toContainText(/mission action|direct to|route/i);
  });
});
