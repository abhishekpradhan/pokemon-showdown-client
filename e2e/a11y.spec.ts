import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { installMockPs } from './mock-ps';

/**
 * Automated accessibility audit.
 *
 * Catches the mechanical failures — contrast, missing names, bad landmark
 * structure — that are easy to introduce and invisible in a screenshot. It is
 * not a substitute for keyboard testing, which lives in smoke.spec.ts.
 */

const ROUTES = ['/', '/teambuilder', '/rooms', '/ladder', '/replays', '/settings'];

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
});

for (const route of ROUTES) {
  test(`${route} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('#workspace')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Report the rule and the offending markup, not just a count.
    const summary = results.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.slice(0, 4).map(node => node.html.slice(0, 160)),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}

test('the battle console is accessible mid-battle', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Unnamed guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: /Choose name/i }).click();
  await page.getByRole('button', { name: 'Find battle' }).click();
  await expect(page).toHaveURL(/\/battle\//);
  await expect(page.getByRole('button', { name: /Moonblast/ })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const summary = results.violations.map(violation => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.slice(0, 4).map(node => node.html.slice(0, 160)),
  }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
});
