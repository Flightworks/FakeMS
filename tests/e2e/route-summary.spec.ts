import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('reports when no simulated route is active', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('ROUTE STATUS');

  await expect(page.getByRole('option', {
    name: /ROUTE STATUS: NO ACTIVE SIM ROUTE/i,
  })).toBeVisible();
});

test('summarizes an authorized simulated route without a map preview', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  let input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('NAV SIM');
  await page.getByRole('option', { name: /NAV: SIM \(DR\)/i }).click();

  await page.keyboard.press('Control+k');
  input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('DCT G01');
  await page.getByRole('option', { name: /DCT G01.*Direct To/i }).first().click();

  const proposal = page.getByRole('dialog', { name: 'Direct-to route proposal status' });
  await expect(proposal).toContainText('AWAITING AUTHORIZATION');
  await proposal.getByRole('button', { name: 'Accept route proposal' }).click();
  await expect(proposal).toContainText('AUTHORIZED · SIM ROUTE SET');

  await page.keyboard.press('Control+k');
  input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('ROUTE STATUS');
  const status = page.getByRole('option', {
    name: /ROUTE STATUS:.*G01.*BRANCH 1\/1.*NEXT: G01/i,
  });
  await expect(status).toBeVisible();
  await expect(status).toContainText('ETE:');
  await expect(status).toContainText('ETA UTC:');
  await expect(page.getByRole('region', { name: 'Projection preview' })).toHaveCount(0);

  await input.fill('LEG');
  await expect(page.getByRole('option', { name: /LEG 1\/1.*NEXT: G01/i })).toBeVisible();

  await input.fill('NEXT');
  await expect(page.getByRole('option', { name: /NEXT: G01.*BRANCH 1\/1/i })).toBeVisible();

  await input.fill('ROUTE ETE');
  await expect(page.getByRole('option', { name: /ROUTE ETE:.*ETE:/i })).toBeVisible();
});
