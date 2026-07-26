import { expect, test } from '@playwright/test';
import { installMockPs } from './mock-ps';

/**
 * Structural guard for every routed surface.
 *
 * CSS changes — pruning dead rules especially — break layout silently: the
 * page still renders, nothing throws, and only a human looking at the right
 * screen notices. These assertions fail instead.
 */

const ROUTES = [
  { path: '/', name: 'matchmaking' },
  { path: '/teambuilder', name: 'team workspace' },
  { path: '/rooms', name: 'rooms' },
  { path: '/ladder', name: 'ladder' },
  { path: '/replays', name: 'replays' },
  { path: '/settings', name: 'settings' },
];

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
});

for (const route of ROUTES) {
  test(`${route.name} renders without collapsed containers`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.locator('#workspace')).toBeVisible();

    // Exactly one main landmark per page — the app shell owns it.
    await expect(page.locator('main')).toHaveCount(1);

    // A container with children but no box means its rule went missing.
    // Deliberately hidden elements (responsive panels) are not breakage, so
    // only laid-out elements count.
    const collapsed = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of document.querySelectorAll('main [class]')) {
        const className = typeof el.className === 'string' ? el.className : '';
        if (!className.trim() || !el.children.length) continue;
        // offsetParent is null for display:none subtrees (and for fixed
        // elements, which we skip explicitly below).
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (style.position !== 'fixed' && !(el as HTMLElement).offsetParent) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) bad.push(className.split(' ')[0]);
      }
      return [...new Set(bad)];
    });
    expect(collapsed).toEqual([]);
  });

  test(`${route.name} does not scroll horizontally`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.locator('#workspace')).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    // One pixel of tolerance for subpixel rounding.
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
}

test.describe('wide desktop', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  for (const route of ROUTES) {
    test(`${route.name} fills the width beside the rail`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator('#workspace')).toBeVisible();

      // Regression: .arena-main once targeted grid column 3 of a two-column
      // shell (a leftover from the removed session sidebar), so the empty 1fr
      // column swallowed the middle of every wide screen and the app rendered
      // right-anchored. Mobile viewports never showed it.
      const rail = await page.locator('.primary-rail').boundingBox();
      const main = await page.locator('.arena-main').boundingBox();
      expect(main, 'arena-main must render').toBeTruthy();
      expect(main!.x, 'content must start beside the rail').toBeLessThanOrEqual(rail!.x + rail!.width + 2);
      expect(main!.x + main!.width, 'content must reach the right edge').toBeGreaterThanOrEqual(1920 - 4);
    });
  }
});

test('every surface keeps its primary heading', async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route.path);
    await expect(
      page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })).first(),
      `${route.name} should have a heading`
    ).toBeVisible();
  }
});

/**
 * Touch-target floor. Desktop density is fine at smaller sizes; a coarse
 * pointer is not, so styles/touch.css enforces a minimum. This asserts the
 * minimum actually survives the cascade — it did not on the first attempt,
 * because per-surface rules outranked it.
 */
test.describe('touch targets', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  for (const route of ROUTES) {
    test(`${route.name} controls are large enough to tap`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator('#workspace')).toBeVisible();

      const undersized = await page.evaluate(() => {
        // Half a pixel of tolerance: a 40px min-height can compute to
        // 39.996 after layout rounding.
        const MIN = 39.5;
        const bad: string[] = [];
        const selector = 'button, a[href], input:not([type=range]), [role="button"], [role="option"]';
        for (const el of document.querySelectorAll(selector)) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          if (rect.height < MIN) {
            const cls = (el.className || '').toString().split(' ')[0];
            bad.push(`${el.tagName.toLowerCase()}.${cls} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
          }
        }
        return [...new Set(bad)];
      });
      expect(undersized, undersized.join('; ')).toEqual([]);
    });
  }
});

test('a joined chat room renders as a full surface with tabs', async ({ page }) => {
  await page.goto('/rooms');
  await expect(page.locator('#workspace')).toBeVisible();
  // The mock serves a lobby; opening it must land on /room/lobby with a tab,
  // and must not loop (the error boundary would show "Something went wrong").
  await page.goto('/room/lobby');
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  await expect(page.locator('.session-tab-title')).toContainText(['Lobby']);
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.locator('.chat-line').first()).toBeVisible();
});

test('server HTML renders sanitized with working poll buttons', async ({ page }) => {
  await page.goto('/room/lobby');

  // The bot's /raw leaderboard renders as a real table, not literal markup.
  const leaderboard = page.locator('.chat-line.is-html table');
  await expect(leaderboard.first()).toBeVisible();
  await expect(leaderboard.getByRole('cell', { name: 'gen 9 is trash man' })).toBeVisible();
  await expect(page.locator('.chat-line', { hasText: '<div' })).toHaveCount(0);

  // Poll buttons survive sanitization and send their command; the server's
  // uhtmlchange then rewrites the named block in place.
  await page.getByRole('button', { name: '1. Spheal Ordeal' }).click();
  await expect(page.getByText('Poll: thanks for voting!')).toBeVisible();
  await expect(page.getByRole('button', { name: '1. Spheal Ordeal' })).toHaveCount(0);
});
