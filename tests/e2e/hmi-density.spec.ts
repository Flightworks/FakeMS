import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test.describe('command palette information density', () => {
  const openPalette = async (page: Page) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Tactical command palette' });
    await expect(palette).toBeVisible();
    return {
      palette,
      input: page.getByRole('textbox', { name: 'Command input' }),
      results: palette.getByRole('listbox', { name: 'Command results' }).getByRole('option'),
    };
  };

  test('keeps the empty palette calm and action labels honest', async ({ page }) => {
    const { palette, results } = await openPalette(page);

    expect(await results.count()).toBeLessThanOrEqual(3);
    await expect(palette).not.toContainText('DIRECT TO');
    await expect(palette).not.toContainText('PRO TIP:');
    await expect(palette).not.toContainText('TACTICAL COMMAND PALETTE');
  });

  test('shows one concise CPA result without unrelated suggestions', async ({ page }) => {
    const { palette, input, results } = await openPalette(page);
    await input.fill('CPA BRAVO');

    expect(await results.count()).toBeLessThanOrEqual(3);
    await expect(palette).toContainText('CPA BRAVO');
    await expect(palette).not.toContainText('SAVE: CPA BRAVO');
    await expect(palette).not.toContainText('DCT BRAVO');
    await expect(palette).not.toContainText('PLAN');
    await expect(palette).not.toContainText('TARGET: N/A');
    await expect(palette).not.toContainText('ASSUMPTIONS: NONE');
    await expect(palette).not.toContainText('STATUS: SIMULATED');
    await expect(palette).not.toContainText('DIRECT TO');
  });

  test('keeps the invitation accessible when no suggestions are available', async ({ page }) => {
    const { palette, results } = await openPalette(page);

    await expect(results).toHaveCount(1);
    await expect(results.first()).toHaveAttribute('aria-disabled', 'true');
    await expect(palette).toContainText('TYPE A COMMAND');
  });

  test('does not execute or choose a target while the entity query is ambiguous', async ({ page }) => {
    const { palette, input } = await openPalette(page);
    await input.fill('INFO');

    await expect(palette).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Direct-to route proposal status' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Route proposal' })).toHaveCount(0);
  });
});
