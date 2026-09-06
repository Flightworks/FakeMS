import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('keeps FOCUS separate from DCT and requires route authorization', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('FOCUS G01');
  await page.getByRole('option', { name: /FOCUS G01/ }).first().evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByRole('dialog', { name: 'Direct-to route proposal status' })).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await expect(input).toBeVisible();
  await input.fill('DCT G01');
  await page.getByRole('option', { name: /DCT G01.*Direct To/ }).first().evaluate((element) => (element as HTMLElement).click());

  const proposal = page.getByRole('dialog', { name: 'Direct-to route proposal status' });
  await expect(proposal).toContainText('AWAITING AUTHORIZATION');
  await expect(proposal.getByRole('button', { name: 'Accept route proposal' })).toBeVisible();
  await proposal.getByRole('button', { name: 'Accept route proposal' }).click();
  await expect(proposal).toContainText('AUTHORIZED · SIM ROUTE SET');
});

test('does not execute an unrelated command while cos45 is loading', async ({ page }) => {
  let resolveMathChunkRequest: (() => void) | undefined;
  const mathChunkRequested = new Promise<void>(resolve => {
    resolveMathChunkRequest = resolve;
  });
  await page.route('**/assets/mathEvaluator-*.js', async (route) => {
    resolveMathChunkRequest?.();
    await new Promise(resolve => setTimeout(resolve, 1_000));
    await route.continue();
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'FIND' }).evaluate((element) => (element as HTMLElement).click());

  const palette = page.getByRole('dialog', { name: 'Tactical command palette' });
  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('cos45');
  await input.press('Enter');

  await expect(palette).toBeVisible();
  await mathChunkRequested;
  const calculation = page.getByRole('option', { name: /cos\(45\) = 0\.70710678118655/ });
  await expect(calculation).toBeVisible({ timeout: 5_000 });
  await calculation.click();
  await expect(palette).toHaveCount(0);
});
