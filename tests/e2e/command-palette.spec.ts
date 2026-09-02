import { expect, test } from '@playwright/test';

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
