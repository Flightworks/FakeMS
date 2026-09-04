import { expect, test } from '@playwright/test';

test.use({
  hasTouch: true,
  viewport: { width: 1024, height: 768 },
});

test('zooms with two fingers without applying a pan to the ownship', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await page.waitForTimeout(500);

  const snapshot = () => page.evaluate(() => {
    const map = document.querySelector('.leaflet-container');
    const viewport = map?.parentElement?.getBoundingClientRect();
    const ownship = Array.from(document.querySelectorAll('.custom-entity-icon'))
      .find(element => element.querySelector('[data-entity-id="ownship"]'))
      ?.getBoundingClientRect();
    const transform = document.querySelector('.leaflet-zoom-animated')?.getAttribute('style') ?? '';
    const scaleMatch = transform.match(/scale\(([-\d.]+)\)/);

    return {
      ownshipX: ownship ? ownship.x + ownship.width / 2 : null,
      ownshipY: ownship ? ownship.y + ownship.height / 2 : null,
      viewportX: viewport ? viewport.x + viewport.width / 2 : null,
      viewportY: viewport ? viewport.y + viewport.height / 2 : null,
      zoomScale: scaleMatch ? Number(scaleMatch[1]) : 1,
    };
  });

  const before = await snapshot();
  expect(before.ownshipX).not.toBeNull();
  expect(before.ownshipY).not.toBeNull();

  const touchPoint = (x: number, y: number, id: number) => ({
    x,
    y,
    radiusX: 12,
    radiusY: 12,
    force: 1,
    id,
  });

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(350, 300, 1)],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(350, 300, 1), touchPoint(674, 300, 2)],
  });

  for (const [left, right] of [[330, 694], [310, 714], [290, 734]]) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [touchPoint(left, 300, 1), touchPoint(right, 300, 2)],
    });
    await page.waitForTimeout(100);
  }

  const during = await snapshot();
  expect(during.zoomScale).toBeGreaterThan(1.05);

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(1_000);

  const after = await snapshot();
  expect(Math.abs((after.ownshipX ?? 0) - (before.ownshipX ?? 0))).toBeLessThan(12);
  expect(Math.abs((after.ownshipY ?? 0) - (before.ownshipY ?? 0))).toBeLessThan(12);
});
