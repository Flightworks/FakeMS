import { expect, test, type Page } from '@playwright/test';

test.use({
  hasTouch: true,
  serviceWorkers: 'block',
  viewport: { width: 1024, height: 768 },
});

const openPaletteFromTouchTrigger = async (page: Page) => {
  await page.goto('/');
  const menuTrigger = page.getByRole('button', { name: 'Toggle tactical menu' });
  await expect(menuTrigger).toBeVisible({ timeout: 15_000 });
  await menuTrigger.tap();
  const trigger = page.getByRole('button', { name: 'FIND' });
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.tap();

  const palette = page.getByRole('dialog', { name: 'Tactical command palette' });
  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(palette).toBeVisible();
  await expect(input).toBeFocused();
  return { palette, input, trigger };
};

test('keeps palette controls touch-sized and restores focus after dismissal', async ({ page }) => {
  const { palette, input, trigger } = await openPaletteFromTouchTrigger(page);
  const closeButton = page.getByRole('button', { name: 'Close command palette' });

  const closeBox = await closeButton.boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeBox!.width).toBeGreaterThanOrEqual(48);
  expect(closeBox!.height).toBeGreaterThanOrEqual(48);

  await input.fill('ETE BRAVO');
  const option = page.getByRole('option', { name: /^ETE BRAVO ·/i }).first();
  await expect(option).toHaveAttribute('aria-disabled', 'true');
  const card = option.getByTestId('command-result-card');
  await expect(card).toBeVisible();

  const details = card.getByText('Détails');
  await details.scrollIntoViewIfNeeded();
  const detailsBox = await details.boundingBox();
  expect(detailsBox).not.toBeNull();
  expect(detailsBox!.width).toBeGreaterThanOrEqual(48);
  expect(detailsBox!.height).toBeGreaterThanOrEqual(48);

  const copy = card.getByRole('button', { name: 'Copier le résultat' });
  const copyBox = await copy.boundingBox();
  expect(copyBox).not.toBeNull();
  expect(copyBox!.width).toBeGreaterThanOrEqual(48);
  expect(copyBox!.height).toBeGreaterThanOrEqual(48);

  await page.touchscreen.tap(
    detailsBox!.x + detailsBox!.width / 2,
    detailsBox!.y + detailsBox!.height / 2,
  );
  await expect(card.getByTestId('command-result-details')).toBeVisible();
  await expect(palette).toBeVisible();
  await expect(option).toHaveAttribute('aria-disabled', 'true');

  await closeButton.tap();
  await expect(palette).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => trigger.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
});

test('dismisses from outside while preserving a center tap', async ({ page }) => {
  const { palette, trigger } = await openPaletteFromTouchTrigger(page);
  const paletteBox = await palette.boundingBox();
  expect(paletteBox).not.toBeNull();

  await page.touchscreen.tap(
    paletteBox!.x + paletteBox!.width / 2,
    paletteBox!.y + paletteBox!.height / 2,
  );
  await expect(palette).toBeVisible();

  await page.touchscreen.tap(12, 12);
  await expect(palette).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('keeps vertical palette gestures away from the map and long-press actions', async ({ page }) => {
  const { palette, input } = await openPaletteFromTouchTrigger(page);
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  await input.fill('DCT');

  const results = page.getByRole('listbox', { name: 'Command results' });
  const resultBox = await results.boundingBox();
  const ownship = page.locator('.custom-entity-icon').first();
  const ownshipBefore = await ownship.boundingBox();
  expect(resultBox).not.toBeNull();
  expect(ownshipBefore).not.toBeNull();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const x = resultBox!.x + resultBox!.width / 2;
  const startY = resultBox!.y + resultBox!.height / 2;
  const touchPoint = (y: number) => ({
    x,
    y,
    radiusX: 12,
    radiusY: 12,
    force: 1,
    id: 1,
  });

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(startY)],
  });
  for (const y of [startY - 60, startY - 120, startY - 180]) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [touchPoint(y)],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect.poll(() => results.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const ownshipAfterScroll = await ownship.boundingBox();
  expect(ownshipAfterScroll).not.toBeNull();
  expect(Math.abs(ownshipAfterScroll!.x - ownshipBefore!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(ownshipAfterScroll!.y - ownshipBefore!.y)).toBeLessThanOrEqual(2);

  const longPressY = resultBox!.y + Math.min(resultBox!.height - 20, 80);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(longPressY)],
  });
  await page.waitForTimeout(1_100);
  await expect(page.getByRole('dialog', { name: 'MAP ACTION radial menu' })).toHaveCount(0);
  await expect(palette).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
});

test('keeps clipboard failure honest on an HTTP LAN origin', async ({ page }) => {
  await page.goto('http://192.168.1.99:4173/FakeMS/');
  await expect.poll(() => page.evaluate(() => window.isSecureContext)).toBe(false);
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('ETE BRAVO @ 140KT');
  const card = page.getByRole('option', { name: /^ETE BRAVO ·/i }).first().getByTestId('command-result-card');
  const copy = card.getByRole('button', { name: 'Copier le résultat' });
  await expect(copy).toBeVisible();
  await copy.scrollIntoViewIfNeeded();
  const copyBox = await copy.boundingBox();
  expect(copyBox).not.toBeNull();
  await page.touchscreen.tap(
    copyBox!.x + copyBox!.width / 2,
    copyBox!.y + copyBox!.height / 2,
  );

  await expect(card.getByRole('alert')).toContainText('presse-papiers sécurisé non disponible');
  await expect(card.getByText('Copie effectuée.')).toHaveCount(0);
});

test('swipes only explicitly swipe-capable commands', async ({ page }) => {
  const { palette, input } = await openPaletteFromTouchTrigger(page);
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });

  await input.fill('DCT G01');
  const directTo = page.getByRole('option', { name: /DCT G01.*Direct To/i }).first();
  await expect(directTo).toBeVisible();
  await directTo.scrollIntoViewIfNeeded();
  await directTo.hover();
  const directToBox = await directTo.boundingBox();
  expect(directToBox).not.toBeNull();
  const swipeY = directToBox!.y + directToBox!.height / 2;
  const point = (x: number) => ({
    x,
    y: swipeY,
    radiusX: 12,
    radiusY: 12,
    force: 1,
    id: 2,
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point(directToBox!.x + 30)],
  });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [point(directToBox!.x + 180)],
  });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  const proposal = page.getByRole('dialog', { name: 'Direct-to route proposal status' });
  await expect(proposal).toContainText('AWAITING AUTHORIZATION');
  await expect(proposal).toContainText('G01');
  await expect(palette).toBeHidden();

  await page.reload();
  const reopened = await openPaletteFromTouchTrigger(page);
  await reopened.input.fill('ETE BRAVO');
  const unavailable = page.getByRole('option', { name: /^ETE BRAVO ·/i }).first();
  await expect(unavailable).toBeVisible();
  await unavailable.scrollIntoViewIfNeeded();
  const unavailableBox = await unavailable.boundingBox();
  expect(unavailableBox).not.toBeNull();
  const unavailableY = unavailableBox!.y + unavailableBox!.height / 2;
  const unavailablePoint = (x: number) => ({
    x,
    y: unavailableY,
    radiusX: 12,
    radiusY: 12,
    force: 1,
    id: 3,
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [unavailablePoint(unavailableBox!.x + 30)],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [unavailablePoint(unavailableBox!.x + 180)],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect(reopened.palette).toBeVisible();
  await expect(unavailable).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('dialog', { name: 'Direct-to route proposal status' })).toHaveCount(0);
});
