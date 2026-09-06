import { expect, test } from './fixtures';
import { installMockPs } from './mock-ps';

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
  await page.goto('/');
  await expect(page.getByText('Online', { exact: true })).toBeVisible();
});

test('home spectating lists battle rooms without chat rooms', async ({ page }) => {
  const live = page.getByRole('region', { name: 'Live battles', exact: true });
  await expect(live.getByRole('button')).toHaveCount(1);
  await expect(live.getByRole('button')).toContainText('CodexTester vs MockRival');
  await expect(live.getByRole('button', { name: /Lobby/ })).toHaveCount(0);
});

test('home setup and readiness stay reachable without sideways scrolling', async ({ page }, testInfo) => {
  for (const width of [320, 412, 768, 1024]) {
    await page.setViewportSize({ width, height: 840 });
    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)!;
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, height: bounds.height, width: bounds.width, scrollWidth: element.scrollWidth };
      };
      return { width: innerWidth, setup: rect('.match-stage'), form: rect('.queue-controls'), fields: [...document.querySelectorAll('.queue-controls .control-field')].map(element => element.getBoundingClientRect().toJSON()), action: rect('.queue-action'), readiness: rect('.match-inspector'), live: rect('.live-now'), chooseName: rect('.match-inspector > .primary-action') };
    });
    for (const target of [geometry.setup, geometry.form, geometry.action, geometry.readiness, ...geometry.fields]) {
      expect(target.left, `${width}px control starts on screen`).toBeGreaterThanOrEqual(0);
      expect(target.right, `${width}px control ends on screen`).toBeLessThanOrEqual(geometry.width);
    }
    expect(geometry.form.scrollWidth, `${width}px form does not overflow internally`).toBeLessThanOrEqual(geometry.form.width + 1);
    expect(geometry.action.height).toBeGreaterThanOrEqual(40);
    if (width <= 560) {
      expect(geometry.fields[1].top).toBeGreaterThanOrEqual(geometry.fields[0].bottom);
      expect(geometry.action.top).toBeGreaterThanOrEqual(geometry.fields[1].bottom);
      expect(geometry.setup.height).toBeLessThan(420);
      expect(geometry.action.bottom).toBeLessThan(600);
      expect(geometry.chooseName.bottom).toBeLessThan(780);
    }
    if (width <= 820) expect(geometry.readiness.bottom).toBeLessThanOrEqual(geometry.live.top);
  }
  await page.setViewportSize({ width: 412, height: 840 });
  await page.screenshot({ path: testInfo.outputPath('home-mobile-layout.png') });
});
