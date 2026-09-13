import { expect, test, type Page } from '@playwright/test';

test.use({
  hasTouch: true,
  serviceWorkers: 'block',
  viewport: { width: 1024, height: 768 },
});
test.describe.configure({ retries: 0 });

const openHmi = async (page: Page) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
  const trigger = page.getByRole('button', { name: 'HMI CFG' });
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();
  const panel = page.getByRole('region', { name: 'HMI settings' });
  await expect(panel).toBeVisible();
  return { panel, trigger };
};

test('keeps HMI choices explicit, touch-sized, and transient', async ({ page }) => {
  const { panel, trigger } = await openHmi(page);

  for (const label of [
    'HUD position',
    'HUD scale',
    'HUD opacity',
    'Track vectors',
    'HUD details',
    'Tap activation threshold',
    'Pie indicator delay',
    'Long-press duration',
    'Interface scale',
    'Radial glow',
    'Map background dim',
    'Animation speed',
    'Haptic feedback',
  ]) {
    await expect(panel.getByText(label, { exact: true })).toBeVisible();
  }

  const vectorButton = panel.getByTestId('hmi-setting-vectors').getByRole('button');
  const descriptionId = await vectorButton.getAttribute('aria-describedby');
  expect(descriptionId).not.toBeNull();
  await expect(page.locator(`#${descriptionId}`)).toContainText('mission vector lines');

  const controls = await panel.locator('button').evaluateAll(elements => elements.map(element => ({
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

  const overflow = await panel.evaluate(element => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    overflowing: Array.from(element.querySelectorAll<HTMLElement>('*'))
      .filter(child => !child.classList.contains('sr-only') && child.scrollWidth > child.clientWidth + 1)
      .map(child => child.dataset.testid ?? child.tagName),
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  expect(overflow.overflowing).toEqual([]);

  await panel.getByRole('button', { name: 'Close panel' }).tap();
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('dims only the map base while preserving mission symbol and vector opacity', async ({ page }) => {
  const { panel } = await openHmi(page);
  await expect(page.locator('.kinematic-vector-line')).toHaveCount(3);

  const before = await page.evaluate(() => ({
    mapBackground: getComputedStyle(document.querySelector<HTMLElement>('[data-map-render-surface] .tactical-map')!).backgroundColor,
    baseOpacity: getComputedStyle(document.querySelector<HTMLElement>('[data-map-render-surface] .tactical-basemap-land')!).opacity,
    vectorOpacity: (() => {
      const element = document.querySelector('.kinematic-vector-line');
      if (!element) return null;
      let current: Element | null = element;
      let opacity = 1;
      while (current) {
        const value = Number.parseFloat(getComputedStyle(current).opacity);
        if (Number.isFinite(value)) opacity *= value;
        if (current.matches('[data-map-render-surface]')) break;
        current = current.parentElement;
      }
      return Number(opacity.toFixed(4));
    })(),
    symbolOpacity: (() => {
      const element = document.querySelector('.custom-entity-icon');
      if (!element) return null;
      let current: Element | null = element;
      let opacity = 1;
      while (current) {
        const value = Number.parseFloat(getComputedStyle(current).opacity);
        if (Number.isFinite(value)) opacity *= value;
        if (current.matches('[data-map-render-surface]')) break;
        current = current.parentElement;
      }
      return Number(opacity.toFixed(4));
    })(),
  }));

  await panel.getByTestId('hmi-setting-map-background-dim').getByRole('button').tap();
  await expect(panel.getByTestId('hmi-setting-map-background-dim')).toContainText('80% dim');

  const after = await page.evaluate(() => ({
    mapBackground: getComputedStyle(document.querySelector<HTMLElement>('[data-map-render-surface] .tactical-map')!).backgroundColor,
    baseOpacity: getComputedStyle(document.querySelector<HTMLElement>('[data-map-render-surface] .tactical-basemap-land')!).opacity,
    vectorOpacity: (() => {
      const element = document.querySelector('.kinematic-vector-line');
      if (!element) return null;
      let current: Element | null = element;
      let opacity = 1;
      while (current) {
        const value = Number.parseFloat(getComputedStyle(current).opacity);
        if (Number.isFinite(value)) opacity *= value;
        if (current.matches('[data-map-render-surface]')) break;
        current = current.parentElement;
      }
      return Number(opacity.toFixed(4));
    })(),
    symbolOpacity: (() => {
      const element = document.querySelector('.custom-entity-icon');
      if (!element) return null;
      let current: Element | null = element;
      let opacity = 1;
      while (current) {
        const value = Number.parseFloat(getComputedStyle(current).opacity);
        if (Number.isFinite(value)) opacity *= value;
        if (current.matches('[data-map-render-surface]')) break;
        current = current.parentElement;
      }
      return Number(opacity.toFixed(4));
    })(),
  }));

  expect(after.mapBackground).not.toBe(before.mapBackground);
  expect(after.baseOpacity).not.toBe(before.baseOpacity);
  expect(after.vectorOpacity).toBe(before.vectorOpacity);
  expect(after.symbolOpacity).toBe(before.symbolOpacity);
  await expect(page.locator('.kinematic-vector-line')).toHaveCount(3);
});

test('keeps one transient panel and applies interface scale to existing HMI surfaces', async ({ page }) => {
  const { panel } = await openHmi(page);
  const trigger = page.getByRole('button', { name: 'HMI CFG' });
  const before = await trigger.boundingBox();
  expect(before).not.toBeNull();

  await panel.getByTestId('hmi-setting-interface-scale').getByRole('button').tap();
  await expect(panel.getByTestId('hmi-setting-interface-scale')).toContainText('1.1×');
  const after = await trigger.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.width).toBeGreaterThan(before!.width + 2);

  await page.getByRole('button', { name: /^NAV/ }).tap();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Simulation toolbox' })).toBeVisible();

  await page.getByRole('button', { name: 'HMI CFG' }).tap();
  await expect(page.getByRole('region', { name: 'Simulation toolbox' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'HMI settings' })).toBeVisible();
});

test('blocks map input while HMI settings remain open', async ({ page }) => {
  const { panel } = await openHmi(page);
  const mapPane = page.locator('.leaflet-map-pane');
  const before = await mapPane.getAttribute('style');
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  await page.mouse.click(viewport!.width - 24, viewport!.height - 24);
  await expect(panel).toBeVisible();
  expect(await mapPane.getAttribute('style')).toBe(before);
});
