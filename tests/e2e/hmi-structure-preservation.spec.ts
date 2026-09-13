import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
test.describe.configure({ retries: 0 });

test('preserves the permanent widgets and quick access keys', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: /NAV/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /STABLN CFG/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /HMI CFG/ })).toBeVisible();

  await page.getByRole('button', { name: 'Toggle tactical menu' }).click();
  await expect(page.getByRole('button', { name: 'STAB', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'VER' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'FIND' })).toBeVisible();
});

test('keeps QAK actions reachable at rest and restores focus without map movement', async ({ page }) => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('button', { name: /NAV/ })).toBeVisible();

    const qak = page.getByRole('navigation', { name: 'Quick access keys' });
    await expect(qak).toBeVisible();
    const qakButtons = qak.getByRole('button');
    await expect(qakButtons).toHaveCount(3);
    expect(await qakButtons.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label'))))
      .toEqual(['STAB', 'FIND', 'VER']);
    const qakBounds = await qakButtons.evaluateAll(elements => elements.map(element => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    }));
    for (const bounds of qakBounds) {
      expect(bounds.width).toBeGreaterThanOrEqual(48);
      expect(bounds.height).toBeGreaterThanOrEqual(48);
    }
    const qakFontSizes = await qakButtons.evaluateAll(elements => elements.map(element => Number.parseFloat(getComputedStyle(element).fontSize)));
    expect(qakFontSizes.every(fontSize => fontSize >= 14)).toBe(true);

    const mapPane = page.locator('.leaflet-map-pane');
    const mapPaneBeforePalette = await mapPane.getAttribute('style');
    const find = page.getByRole('button', { name: 'FIND' });
    await find.click();
    const palette = page.getByRole('dialog', { name: 'Tactical command palette' });
    const input = page.getByRole('textbox', { name: 'Command input' });
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(palette).toHaveCount(0);
    await expect(find).toBeFocused();
    expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforePalette);

    const version = page.getByRole('button', { name: 'VER' });
    await version.click();
    const changelog = page.getByRole('dialog', { name: 'Changelog' });
    await expect(changelog).toBeVisible();
    await changelog.getByRole('button', { name: 'Close changelog' }).click();
    await expect(changelog).toHaveCount(0);
    await expect(version).toBeFocused();
    expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforePalette);

    await version.click();
    await expect(changelog).toBeVisible();
    await page.mouse.click(viewport.width - 8, viewport.height - 8);
    await expect(changelog).toHaveCount(0);
    await expect(version).toBeFocused();
    expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforePalette);
  }
});

test('opens the single T19 stabilisation panel from STAB without changing state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /NAV/ })).toBeVisible();

  const stab = page.getByRole('button', { name: 'STAB', exact: true });
  await stab.click();
  const panel = page.getByRole('region', { name: 'Stabilisation controls' });
  await expect(panel).toBeVisible();
  await expect(page.getByRole('region', { name: 'Stabilisation controls' })).toHaveCount(1);
  await expect(panel.getByTestId('stabilisation-state')).toContainText('HELICO · OWNSHIP FOLLOW');

  await panel.getByRole('button', { name: 'Close panel' }).click();
  await expect(panel).toHaveCount(0);
  await expect(stab).toBeFocused();
});

test('closes direct-to details explicitly without accepting or changing the map', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  const find = page.getByRole('button', { name: 'FIND' });
  await find.click();
  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('DCT G01');
  await page.getByRole('option', { name: /DCT G01.*Direct To/i }).first().click();

  const mapPane = page.locator('.leaflet-map-pane');
  const mapPaneBeforeClose = await mapPane.getAttribute('style');
  const proposal = page.getByRole('dialog', { name: 'Direct-to route proposal status' });
  await expect(proposal).toContainText('AWAITING AUTHORIZATION');
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(0);
  await page.mouse.click(700, 400);
  await expect(proposal).toBeVisible();
  expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforeClose);
  await page.getByRole('button', { name: 'Close direct-to route proposal' }).click();
  await expect(proposal).toHaveCount(0);
  await expect(find).toBeFocused();
  expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforeClose);

  await find.click();
  await page.getByRole('textbox', { name: 'Command input' }).fill('DCT G01');
  await page.getByRole('option', { name: /DCT G01.*Direct To/i }).first().click();
  const rejectedProposal = page.getByRole('dialog', { name: 'Direct-to route proposal status' });
  await rejectedProposal.getByRole('button', { name: 'Reject route proposal' }).click();
  await expect(rejectedProposal).toContainText('REJECTED');
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(0);
  expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforeClose);
  await page.keyboard.press('Escape');
  await expect(rejectedProposal).toHaveCount(0);
  await expect(find).toBeFocused();
});

test('closes an opened document without map movement and returns focus to FIND', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /NAV/ })).toBeVisible();
  const find = page.getByRole('button', { name: 'FIND' });
  await find.click();
  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('OPEN CHANGELOG.md');
  await page.getByRole('option', { name: 'Open: CHANGELOG.md · Scratchpad Document' }).click();

  const mapPane = page.locator('.leaflet-map-pane');
  const mapPaneBeforeClose = await mapPane.getAttribute('style');
  await expect(page.getByText('CHANGELOG.md', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close document viewer' }).click();
  await expect(page.getByText('CHANGELOG.md', { exact: true })).toHaveCount(0);
  await expect(find).toBeFocused();
  expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforeClose);

  await find.click();
  await page.getByRole('textbox', { name: 'Command input' }).fill('OPEN CHANGELOG.md');
  await page.getByRole('option', { name: 'Open: CHANGELOG.md · Scratchpad Document' }).click();
  await expect(page.getByText('CHANGELOG.md', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('CHANGELOG.md', { exact: true })).toHaveCount(0);
  await expect(find).toBeFocused();
  expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforeClose);

  await find.click();
  await page.getByRole('textbox', { name: 'Command input' }).fill('OPEN CHANGELOG.md');
  await page.getByRole('option', { name: 'Open: CHANGELOG.md · Scratchpad Document' }).click();
  await expect(page.getByText('CHANGELOG.md', { exact: true })).toBeVisible();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('viewport is not measurable');
  await page.mouse.click(viewport.width - 8, viewport.height - 8);
  await expect(page.getByText('CHANGELOG.md', { exact: true })).toHaveCount(0);
  await expect(find).toBeFocused();
  expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforeClose);
});

test('closes the mission action journal without executing or changing the active route', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });

  const nav = page.getByRole('button', { name: /^NAV/ });
  await nav.click();
  const simulation = page.getByRole('region', { name: 'Simulation toolbox' });
  await simulation.getByRole('button', { name: 'Pause simulation' }).click();
  await nav.click();

  const find = page.getByRole('button', { name: 'FIND' });
  await find.click();
  let input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('DCT G01');
  await page.getByRole('option', { name: /DCT G01.*Direct To/i }).first().click();
  const proposal = page.getByRole('dialog', { name: 'Direct-to route proposal status' });
  await proposal.getByRole('button', { name: 'Accept route proposal' }).click();
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close direct-to route proposal' }).click();

  const mapPane = page.locator('.leaflet-map-pane');
  const mapPaneBeforeJournal = await mapPane.getAttribute('style');
  await find.click();
  input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('ROUTE CLEAR');
  const clear = page.getByRole('option', { name: /ROUTE CLEAR/i }).filter({ hasText: 'CONFIRMATION REQUIRED' });
  await clear.click();

  const journal = page.getByRole('dialog', { name: 'Mission action status' });
  await expect(journal).toContainText('PROPOSED');
  await expect(page.getByRole('dialog', { name: 'Mission action status' })).toHaveCount(1);
  await page.mouse.click(700, 400);
  await expect(journal).toBeVisible();
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(1);
  expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforeJournal);
  await journal.getByRole('button', { name: 'Close mission action panel' }).click();
  await expect(journal).toHaveCount(0);
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(1);
  await expect(find).toBeFocused();
  expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforeJournal);

  await find.click();
  input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('ROUTE CLEAR');
  await page.getByRole('option', { name: /ROUTE CLEAR/i }).filter({ hasText: 'CONFIRMATION REQUIRED' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Mission action status' })).toHaveCount(0);
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(1);
  await expect(find).toBeFocused();
  expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforeJournal);

  await find.click();
  input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('ROUTE CLEAR');
  await page.getByRole('option', { name: /ROUTE CLEAR/i }).filter({ hasText: 'CONFIRMATION REQUIRED' }).click();
  const rejected = page.getByRole('dialog', { name: 'Mission action status' });
  await rejected.getByRole('button', { name: 'Reject mission action' }).click();
  await expect(rejected).toContainText('REJECTED');
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(1);
  expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforeJournal);
});

test('keeps the radial menu available on the map', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });

  await page.mouse.move(700, 400);
  await page.mouse.down();
  const radial = page.getByRole('dialog', { name: 'MAP ACTION radial menu' });
  await expect(radial).toBeVisible({ timeout: 5_000 });
  await page.mouse.up();
});

test('owns radial release and cancellation without map leakage or duplicate action', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });

  const mapPane = page.locator('.leaflet-map-pane');
  await page.mouse.move(700, 400);
  await page.mouse.down();
  const radial = page.getByRole('dialog', { name: 'MAP ACTION radial menu' });
  await expect(radial).toBeVisible({ timeout: 5_000 });
  const mapPaneBeforeOutsideRelease = await mapPane.getAttribute('style');
  await page.mouse.move(20, 20);
  await page.mouse.up();
  await expect(radial).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforeOutsideRelease);
  await expect(page.locator('circle[stroke="#10b981"]')).toHaveCount(0);

  await page.mouse.move(700, 400);
  await page.mouse.down();
  await expect(radial).toBeVisible({ timeout: 5_000 });
  const cancel = radial.getByRole('button', { name: 'Cancel radial menu' });
  const cancelBounds = await cancel.boundingBox();
  if (!cancelBounds) throw new Error('radial center cancel button is not measurable');
  await page.mouse.move(cancelBounds.x + cancelBounds.width / 2, cancelBounds.y + cancelBounds.height / 2);
  await page.mouse.up();
  await expect(radial).toHaveCount(0);

  // A real pointer click through the parent and leaf must toggle VECTORS once,
  // not once on pointerup and again on the follow-up browser click.
  await page.mouse.move(700, 400);
  await page.mouse.down();
  await expect(radial).toBeVisible({ timeout: 5_000 });
  await radial.getByRole('button', { name: 'Affichage', exact: true }).click();
  await radial.getByRole('button', { name: 'Vecteurs', exact: true }).click();
  await page.mouse.up();
  await expect(radial).toHaveCount(0);
  await expect(page.locator('.kinematic-vector-line')).toHaveCount(0);
  await expect(page.getByTestId('vector-layer-status')).toHaveText('VECTORS OFF');
});
