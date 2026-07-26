import { expect, test } from '@playwright/test';
import { installMockPs } from './mock-ps';

/**
 * Regression coverage for the login handshake.
 *
 * The client previously sent `/trn <name>` with no assertion, which every real
 * server rejects, so nobody could get a name and nothing downstream worked.
 * It shipped green because the mock accepted any `/trn`. The mock now enforces
 * the assertion, and these tests assert on the handshake itself rather than on
 * "some updateuser arrived" — the server sends an unnamed one on connect.
 */

const actionCalls = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('__mockActionCalls') || '[]') as string[]);

const sentMessages = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('__mockPsSent') || '[]') as string[]);

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
});

test('signs a guest name with an assertion from the login server', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Unnamed guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: /Choose name/i }).click();

  await expect(page.getByRole('button', { name: 'CodexTester', exact: true })).toBeVisible();

  const calls = await actionCalls(page);
  expect(calls.some(call => call.includes('act=getassertion') && call.includes('userid=codextester'))).toBe(true);
  expect(calls.some(call => call.includes('challstr='))).toBe(true);

  // The whole point: `/trn` must carry the assertion.
  const sent = await sentMessages(page);
  const trn = sent.find(message => message.includes('/trn '));
  expect(trn).toBeTruthy();
  expect(trn).toContain('/trn CodexTester,0,4|mock-assertion-for-codextester');
});

test('never sends an unsigned /trn', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Unnamed guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: /Choose name/i }).click();
  await expect(page.getByRole('button', { name: 'CodexTester', exact: true })).toBeVisible();

  const sent = await sentMessages(page);
  const unsigned = sent.filter(message => /\/trn [^,]+$/.test(message.trim()));
  expect(unsigned).toEqual([]);
});

test('asks for a password when the name is registered', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Unnamed guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('RegisteredName');
  await page.getByRole('button', { name: /Choose name/i }).click();

  // A bare `;` means "registered" — it must read as a next step, not a failure.
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/registered account/i)).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Password' }))
    .toHaveAttribute('placeholder', /registered/i);

  // The dialog stays open on the password step, and nothing is sent until the
  // login server actually hands back an assertion.
  await expect(dialog).toBeVisible();
  const sent = await sentMessages(page);
  expect(sent.some(message => message.includes('/trn '))).toBe(false);
});

test('strips the group symbol from the display name', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Unnamed guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: /Choose name/i }).click();

  // The server sends "|updateuser| CodexTester|1|0" — the leading space is the
  // group symbol, not part of the name.
  await expect(page.getByRole('button', { name: 'CodexTester', exact: true })).toBeVisible();
});

/**
 * Phase 2 acceptance: joining someone else's battle renders a spectator view.
 * This was structurally broken before the engine swap — nothing ever assigned
 * spectator mode, so watchers were rendered as player 1 with fabricated
 * exact HP and player-waiting copy.
 */
test('spectating renders a true spectator view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Unnamed guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: /Choose name/i }).click();
  await expect(page.getByRole('button', { name: 'CodexTester', exact: true })).toBeVisible();

  await page.goto('/battle/battle-gen9uu-spectate1');
  await expect(page.locator('.battle-room-title')).toContainText('AlphaPlayer');
  await expect(page.locator('.battle-room-title')).toContainText('BetaPlayer');

  // Both sides show percentages — a spectator can never know exact HP.
  await expect(page.locator('.hp-readout').first()).toContainText('%');
  const readouts = await page.locator('.hp-readout').allTextContents();
  for (const readout of readouts) expect(readout).not.toMatch(/\d+\/\d+/);

  // No action deck for a watcher: no move buttons, no team bench switches.
  await expect(page.locator('.move-choice')).toHaveCount(0);
  await expect(page.getByText(/spectating/i).first()).toBeVisible();

  // Actions announce themselves on the field. The mock's turn ends on a
  // super-effective note, which is the label the banner settles on.
  await expect(page.locator('.field-announce')).toHaveText("It's super effective!");

  // Spectating must not trap navigation: the battle takes focus once when it
  // opens, and after that every other surface stays reachable.
  await page.getByRole('link', { name: 'Teams' }).click();
  await expect(page).toHaveURL(/\/teambuilder/);
  await page.getByRole('link', { name: 'Rooms' }).click();
  await expect(page).toHaveURL(/\/rooms/);
});
