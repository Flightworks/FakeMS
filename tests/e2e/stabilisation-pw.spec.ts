import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
test.describe.configure({ retries: 0 });

const viewports = [
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
];

const openStabilisation = async (page: Page) => {
  const trigger = page.getByRole('button', { name: /STABLN CFG/ });
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();
  const panel = page.getByRole('region', { name: 'Stabilisation controls' });
  await expect(panel).toBeVisible();
  return { trigger, panel };
};

const switchToSimulation = async (page: Page) => {
  const nav = page.getByRole('button', { name: /^NAV/ });
  await nav.click();
  const toolbox = page.getByRole('region', { name: 'Simulation toolbox' });
  await expect(toolbox).toBeVisible();
  await toolbox.getByRole('button', { name: 'SIM', exact: true }).click();
  await expect(page.getByRole('button', { name: /^NAV/ })).toContainText('SIM');
  await page.getByRole('button', { name: /^NAV/ }).click();
  await expect(toolbox).toHaveCount(0);
};

const dragMap = async (page: Page, dx = 90, dy = 30) => {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('viewport is not measurable');
  const startX = viewport.width * 0.8;
  const startY = viewport.height * 0.65;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 5 });
  await page.mouse.up();
};

test('exposes real stabilisation effects across simulation, pan, and orientation', async ({ page }) => {
  test.setTimeout(60_000);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
    await switchToSimulation(page);

    const { trigger, panel } = await openStabilisation(page);
    await expect(panel.getByTestId('stabilisation-state')).toContainText('HELICO · OWNSHIP FOLLOW');
    await expect(panel.getByRole('button', { name: 'GND · FIXED-GROUND ANCHOR' })).toBeVisible();
    await expect(panel).toContainText('Orientation · NORTH UP / HEADING UP');
    const controls = await panel.locator('button, summary').evaluateAll(elements => elements.map(element => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
    })));
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.width).toBeGreaterThanOrEqual(48);
      expect(control.height).toBeGreaterThanOrEqual(48);
      expect(control.fontSize).toBeGreaterThanOrEqual(14);
    }

    await panel.getByRole('button', { name: 'GND · FIXED-GROUND ANCHOR' }).click();
    await expect(panel).toHaveAttribute('data-stab-mode', 'GND');
    const anchor = await panel.getAttribute('data-ground-anchor');
    expect(anchor).not.toBeNull();
    expect(anchor).not.toBe('none');
    await expect(trigger).toContainText('SOL');

    const ownshipMarker = page.locator('.leaflet-marker-icon').filter({
      has: page.locator('[data-entity-id="ownship"]'),
    });
    await expect(ownshipMarker).toHaveCount(1);
    const markerBeforeMovement = await ownshipMarker.boundingBox();
    if (!markerBeforeMovement) throw new Error('ownship marker bounds are not measurable');
    const markerBeforeMovementStyle = await ownshipMarker.getAttribute('style');
    await expect.poll(
      () => ownshipMarker.getAttribute('style'),
      { timeout: 5_000, message: 'ownship marker should move while SIM is running in GND' },
    ).not.toBe(markerBeforeMovementStyle);

    await panel.getByRole('button', { name: 'Close panel' }).click();
    await expect(panel).toHaveCount(0);
    await dragMap(page);
    await expect(trigger).toContainText('SOL');
    await trigger.click();
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: 'Select HEADING UP orientation' }).click();
    await expect(panel).toHaveAttribute('data-map-mode', 'HEADING_UP');
    await expect(panel).toHaveAttribute('data-ground-anchor', anchor!);
    await expect(panel).toContainText('Orientation changes only the map rotation');

    await panel.getByRole('button', { name: 'Select NORTH UP orientation' }).click();
    await expect(panel).toHaveAttribute('data-map-mode', 'NORTH_UP');
    await expect(panel).toHaveAttribute('data-ground-anchor', anchor!);

    await panel.getByRole('button', { name: 'Instant recenter return' }).click();
    await expect(panel.getByRole('button', { name: 'Instant recenter return' })).toHaveAttribute('aria-pressed', 'true');
    await panel.getByRole('button', { name: 'Recenter map on ownship' }).click();
    await expect(panel).toHaveAttribute('data-stab-mode', 'HELICO');
    await expect(panel).toHaveAttribute('data-ground-anchor', 'none');
    await expect(panel.getByTestId('stabilisation-state')).toContainText('HELICO · OWNSHIP FOLLOW');
    await expect.poll(async () => {
      const mapBounds = await page.getByLabel('Map interaction surface').boundingBox();
      const markerBounds = await ownshipMarker.boundingBox();
      if (!mapBounds || !markerBounds) return Number.POSITIVE_INFINITY;
      const mapCenter = { x: mapBounds.x + mapBounds.width / 2, y: mapBounds.y + mapBounds.height / 2 };
      const markerCenter = { x: markerBounds.x + markerBounds.width / 2, y: markerBounds.y + markerBounds.height / 2 };
      return Math.max(Math.abs(markerCenter.x - mapCenter.x), Math.abs(markerCenter.y - mapCenter.y));
    }, { timeout: 5_000 }).toBeLessThan(20);

    await panel.getByRole('button', { name: 'Close panel' }).click();
    await expect(page.getByRole('region', { name: 'Stabilisation controls' })).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    const reopenedPanel = page.getByRole('region', { name: 'Stabilisation controls' });
    await reopenedPanel.getByRole('button', { name: 'GND · FIXED-GROUND ANCHOR' }).click();
    await expect(reopenedPanel).toHaveAttribute('data-stab-mode', 'GND');
    const modeBeforeOutsideClose = await reopenedPanel.getAttribute('data-stab-mode');
    const mapPane = page.locator('.leaflet-map-pane');
    const mapPaneBeforeOutsideClose = await mapPane.getAttribute('style');
    const outsideViewport = page.viewportSize();
    if (!outsideViewport) throw new Error('viewport is not measurable');
    await page.mouse.click(outsideViewport.width * 0.8, outsideViewport.height * 0.65);
    await expect(page.getByRole('region', { name: 'Stabilisation controls' })).toHaveCount(0);
    expect(await mapPane.getAttribute('style')).toBe(mapPaneBeforeOutsideClose);
    await trigger.click();
    await expect(page.getByRole('region', { name: 'Stabilisation controls' })).toHaveAttribute('data-stab-mode', modeBeforeOutsideClose!);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Stabilisation controls' })).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

test('waits for the configured auto-recenter delay before returning to ownship follow', async ({ page }) => {
  await page.setViewportSize(viewports[0]);
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
  await switchToSimulation(page);

  const { trigger, panel } = await openStabilisation(page);
  const delay = panel.getByRole('button', { name: /Cycle automatic recenter delay/ });
  await delay.click();
  await expect(panel).toContainText('after 5s of pan inactivity');
  await panel.getByRole('button', { name: 'Close panel' }).click();
  await expect(trigger).toBeFocused();

  await trigger.click();
  const groundPanel = page.getByRole('region', { name: 'Stabilisation controls' });
  await groundPanel.getByRole('button', { name: 'GND · FIXED-GROUND ANCHOR' }).click();
  await groundPanel.getByRole('button', { name: 'Close panel' }).click();
  await expect(trigger).toBeFocused();
  await dragMap(page);
  await expect(trigger).toContainText('SOL');

  // This is a real-clock wait: the configured 5s delay must not be shortened.
  await page.waitForTimeout(3_000);
  await expect(trigger).toContainText('SOL');

  await page.waitForTimeout(2_500);
  await expect(trigger).toContainText('SUIVI');
});
