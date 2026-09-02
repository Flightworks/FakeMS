import { expect, test } from '@playwright/test';

test('registers a build-scoped PWA and exposes an explicit update contract', async ({ page }) => {
  await page.goto('/');

  const pwaState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const cacheKeys = await caches.keys();
    const script = await fetch(`${new URL('./sw.js', window.location.href)}`).then(response => response.text());
    return {
      scope: registration.scope,
      controller: Boolean(navigator.serviceWorker.controller),
      cacheKeys,
      script,
    };
  });

  expect(pwaState.scope).toContain('/FakeMS/');
  expect(pwaState.controller).toBe(true);
  expect(pwaState.cacheKeys).toContain('fake-ms-shell-e2e');
  expect(pwaState.script).toContain("type === 'SKIP_WAITING'");
  await expect(page.getByRole('button', { name: 'Apply update and reload' })).toHaveCount(0);
});
