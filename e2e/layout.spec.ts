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

test('every surface keeps its primary heading', async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route.path);
    await expect(
      page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })).first(),
      `${route.name} should have a heading`
    ).toBeVisible();
  }
});
