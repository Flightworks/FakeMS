import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('shows, hides, and clears a simulated route only after confirmation', async ({ page }) => {
  await page.goto('/');
  await page.locator('.leaflet-container').waitFor({ state: 'visible' });

  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('DCT G01');
  await page.getByRole('option', { name: /DCT G01.*Direct To/ }).first().evaluate(element => (element as HTMLElement).click());

  const directTo = page.getByRole('dialog', { name: 'Direct-to route proposal status' });
  await directTo.getByRole('button', { name: 'Accept route proposal' }).click();
  await expect(directTo).toContainText('AUTHORIZED · SIM ROUTE SET');
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(1);

  await page.keyboard.press('Control+k');
  await input.fill('ROUTE HIDE');
  const hide = page.getByRole('option', { name: /ROUTE HIDE/i }).filter({ hasText: 'LOCAL DISPLAY ONLY' });
  await expect(hide).toBeVisible();
  await hide.click();
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await input.fill('ROUTE SHOW');
  const show = page.getByRole('option', { name: /ROUTE SHOW/i }).filter({ hasText: 'LOCAL DISPLAY ONLY' });
  await show.click();
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(1);

  await page.keyboard.press('Control+k');
  await input.fill('ROUTE CLEAR');
  const cancelClear = page.getByRole('option', { name: /ROUTE CLEAR/i }).filter({ hasText: 'CONFIRMATION REQUIRED' });
  await cancelClear.click();
  const cancelledMissionAction = page.getByRole('dialog', { name: 'Mission action status' });
  await cancelledMissionAction.getByRole('button', { name: 'Reject mission action' }).click();
  await expect(cancelledMissionAction).toContainText('REJECTED');
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(1);

  await page.keyboard.press('Control+k');
  await input.fill('ROUTE CLEAR');
  const clear = page.getByRole('option', { name: /ROUTE CLEAR/i }).filter({ hasText: 'CONFIRMATION REQUIRED' });
  await clear.click();

  const missionAction = page.getByRole('dialog', { name: 'Mission action status' });
  await expect(missionAction).toContainText('PROPOSED');
  await missionAction.getByRole('button', { name: 'Preview mission action' }).click();
  await expect(missionAction).toContainText('AWAITING AUTHORIZATION');
  await missionAction.getByRole('button', { name: 'Authorize mission action' }).click();
  await expect(missionAction).toContainText('AUTHORIZED · READY TO EXECUTE');
  await missionAction.getByRole('button', { name: 'Execute simulated action' }).click();
  await expect(missionAction).toContainText('COMPLETED · SIMULATION');
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(0);
});
