import { expect, test } from '@playwright/test';
import { installMockPs } from './mock-ps';

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('matchmaking cockpit visual baseline', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();
  await expect(page.getByText('Online', { exact: true })).toBeVisible();
  // The mock joins Lobby immediately after connecting; wait for the session
  // tab so fast and slow runs screenshot the same steady state.
  await expect(page.getByRole('button', { name: 'Lobby', exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('matchmaking-cockpit.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.04,
  });
});

test('battle cockpit visual baseline', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Unnamed guest' }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: /Choose name/i }).click();
  await expect(page.getByRole('button', { name: 'CodexTester', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Find battle' }).click();
  await expect(page).toHaveURL(/\/battle\/battle-gen9ou-1/);
  await expect(page.getByRole('button', { name: /Moonblast/ })).toBeVisible();
  await expect(page).toHaveScreenshot('battle-cockpit.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.04,
  });
});
