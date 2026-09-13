import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test.describe('command palette information density', () => {
  const openPalette = async (page: Page) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Tactical command palette' });
    await expect(palette).toBeVisible();
    return {
      palette,
      input: page.getByRole('textbox', { name: 'Command input' }),
      results: palette.getByRole('listbox', { name: 'Command results' }).getByRole('option'),
    };
  };

  test('keeps the empty palette calm and action labels honest', async ({ page }) => {
    const { palette, results } = await openPalette(page);

    expect(await results.count()).toBeLessThanOrEqual(3);
    await expect(palette).not.toContainText('DIRECT TO');
    await expect(palette).not.toContainText('PRO TIP:');
    await expect(palette).not.toContainText('TACTICAL COMMAND PALETTE');
  });

  test('shows one concise CPA result without unrelated suggestions', async ({ page }) => {
    const { palette, input, results } = await openPalette(page);
    await input.fill('CPA BRAVO');

    expect(await results.count()).toBeLessThanOrEqual(3);
    await expect(palette).toContainText('CPA BRAVO');
    await expect(palette).not.toContainText('SAVE: CPA BRAVO');
    await expect(palette).not.toContainText('DCT BRAVO');
    await expect(palette).not.toContainText('PLAN');
    await expect(palette).not.toContainText('TARGET: N/A');
    await expect(palette).not.toContainText('ASSUMPTIONS: NONE');
    await expect(palette).not.toContainText('STATUS: SIMULATED');
    await expect(palette).not.toContainText('DIRECT TO');
  });

  test('keeps the invitation accessible when no suggestions are available', async ({ page }) => {
    const { palette, results } = await openPalette(page);

    await expect(results).toHaveCount(1);
    await expect(results.first()).toHaveAttribute('aria-disabled', 'true');
    await expect(palette).toContainText('TYPE A COMMAND');
  });

  test('does not execute or choose a target while the entity query is ambiguous', async ({ page }) => {
    const { palette, input } = await openPalette(page);
    await input.fill('INFO');

    await expect(palette).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Direct-to route proposal status' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Route proposal' })).toHaveCount(0);
  });

  test('does not let a typed result value or qualification widen the palette', async ({ page }) => {
    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      const { palette, input } = await openPalette(page);
      await input.fill('ETE BRAVO @ 140KT');

      const card = palette.getByTestId('command-result-card').first();
      await expect(card).toBeVisible();
      await expect(card.getByTestId('command-result-primary')).toContainText('ETE');
      await expect(card.getByTestId('command-result-qualification')).toContainText('GS HYPOTHÈSE');
      await expect(card.getByText('Détails')).toBeVisible();
      await expect(card.getByRole('button', { name: 'Copier le résultat' })).toBeVisible();

      const readOverflow = () => palette.evaluate((element) => {
        const overflowing = Array.from(element.querySelectorAll<HTMLElement>('*'))
          .filter(child => child.scrollWidth > child.clientWidth + 1)
          .map(child => ({
            testId: child.getAttribute('data-testid'),
            className: child.className,
            scrollWidth: child.scrollWidth,
            clientWidth: child.clientWidth,
          }));
        return {
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          overflowing,
        };
      });
      await expect.poll(async () => (await readOverflow()).overflowing, { timeout: 5_000 }).toEqual([]);
      const overflow = await readOverflow();
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
      expect(overflow.overflowing).toEqual([]);
    }
  });

  test('keeps first-use result text and controls readable at both target viewports', async ({ page }) => {
    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      const { palette, input } = await openPalette(page);
      await input.fill('ETE BRAVO @ 140KT');

      const card = palette.getByTestId('command-result-card').first();
      const typography = await card.evaluate((element) => {
        const primary = element.querySelector<HTMLElement>('[data-testid="command-result-primary"]');
        const value = primary?.querySelector<HTMLElement>('strong');
        const unit = primary?.querySelector<HTMLElement>('span:last-child');
        const qualification = element.querySelector<HTMLElement>('[data-testid="command-result-qualification"]');
        return {
          valueFontSize: value ? Number.parseFloat(getComputedStyle(value).fontSize) : 0,
          unitFontSize: unit ? Number.parseFloat(getComputedStyle(unit).fontSize) : 0,
          qualificationFontSize: qualification ? Number.parseFloat(getComputedStyle(qualification).fontSize) : 0,
          valueOverflow: value ? getComputedStyle(value).textOverflow : 'missing',
        };
      });
      expect(typography.valueFontSize).toBeGreaterThanOrEqual(18);
      expect(typography.unitFontSize).toBeGreaterThanOrEqual(14);
      expect(typography.qualificationFontSize).toBeGreaterThanOrEqual(14);
      expect(typography.valueOverflow).not.toBe('ellipsis');

      const controls = await palette.locator('button, summary').evaluateAll(elements => elements.map(element => ({
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
    }
  });

  test('keeps permanent system controls reachable and readable', async ({ page }) => {
    await page.goto('/');
    const topBar = page.locator('div.absolute.top-0.left-0.right-0.z-40').first();
    const buttons = topBar.getByRole('button');
    await expect(buttons).not.toHaveCount(0);

    const contracts = await buttons.evaluateAll(elements => elements.map(element => ({
      target: element.classList.contains('hmi-active-target'),
      focus: element.classList.contains('hmi-focus-ring'),
      action: element.classList.contains('hmi-action-text'),
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    })));
    expect(contracts.every(control => control.target && control.focus && control.action)).toBe(true);
    for (const control of contracts) {
      expect(control.width).toBeGreaterThanOrEqual(48);
      expect(control.height).toBeGreaterThanOrEqual(48);
    }

    const labels = await buttons.locator('span').evaluateAll(elements => elements
      .filter(element => element.textContent?.trim())
      .map(element => Number.parseFloat(getComputedStyle(element).fontSize)));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every(fontSize => fontSize >= 14)).toBe(true);
  });

  test('suppresses nonessential motion without hiding the palette', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { palette } = await openPalette(page);

    const motion = await palette.evaluate(element => {
      const style = getComputedStyle(element);
      return {
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
        visibility: style.visibility,
        opacity: style.opacity,
      };
    });
    expect(motion.animationDuration).toBe('0s');
    expect(motion.transitionDuration).toBe('0s');
    expect(motion.visibility).toBe('visible');
    expect(motion.opacity).not.toBe('0');
  });

  test('keeps HMI settings choices readable at both target viewports', async ({ page }) => {
    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });

      const trigger = page.getByRole('button', { name: 'HMI CFG' });
      await trigger.click();
      const panel = page.getByRole('region', { name: 'HMI settings' });
      await expect(panel).toBeVisible();
      await expect(panel.getByText('Map background dim', { exact: true })).toBeVisible();
      await expect(panel.getByText('Interface scale', { exact: true })).toBeVisible();

      const controls = await panel.locator('button').evaluateAll(elements => elements.map(element => ({
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      })));
      expect(controls.length).toBeGreaterThan(0);
      expect(controls.every(control => control.width >= 48 && control.height >= 48 && control.fontSize >= 14)).toBe(true);

      const descriptions = await panel.locator('p').evaluateAll(elements => elements.map(element => ({
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        text: element.textContent?.trim(),
      })));
      expect(descriptions.length).toBeGreaterThanOrEqual(10);
      expect(descriptions.every(description => description.fontSize >= 14 && Boolean(description.text))).toBe(true);

      const bounds = await panel.evaluate(element => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }));
      expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);

      await panel.getByRole('button', { name: 'Close panel' }).click();
      await expect(panel).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  });
});
