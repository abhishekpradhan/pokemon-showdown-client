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
  await page.getByRole('button', { name: /Use guest name/i }).click();
  await page.getByRole('button', { name: 'Find battle' }).click();
  await expect(page).toHaveURL(/\/battle\//);
  await expect(page.getByRole('button', { name: /Moonblast/ })).toBeVisible();
  // Audit the settled UI: the combatant entrance fade briefly blends every
  // nameplate toward the backdrop, and axe would measure that transient.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.combatant')].every(element => Number(getComputedStyle(element).opacity) >= 0.99)
  );

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

test('light theme applies and passes the contrast audit', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/settings');
  // System default resolves to the emulated OS scheme…
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // …and pinning Dark/Light in Settings overrides it.
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  for (const route of ['/', '/rooms', '/teambuilder']) {
    await page.goto(route);
    await expect(page.locator('#workspace')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const summary = results.violations.map(violation => ({
      id: violation.id,
      route,
      nodes: violation.nodes.slice(0, 4).map(node => node.html.slice(0, 120)),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  }
});
