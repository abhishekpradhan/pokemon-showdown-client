import { expect, test } from '@playwright/test';
import { installMockPs } from './mock-ps';

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
});

test('loads home with real readiness states and no demo language', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();
  await expect(page.getByText(/demo|fixture|preview/i)).toHaveCount(0);
  await expect(page.getByText('Choose a player name')).toBeVisible();
  await expect(page.getByRole('button', { name: /find battle/i })).toBeDisabled();

  await page.getByRole('button', { name: /Unnamed guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: /Choose name/i }).click();
  await expect(page.getByText('Waiting for server confirmation.')).toBeVisible();
  await expect(page.getByRole('button', { name: /CodexTester/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /find battle/i })).toBeEnabled();
});

test('format combobox filters and selects live formats', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Select battle format' }).click();
  await page.getByRole('combobox', { name: 'Select battle format filter' }).fill('random');
  await page.getByRole('option', { name: /\[Gen 9\] Random Battle/ }).click();
  await expect(page.getByRole('button', { name: 'Select battle format' })).toContainText('[Gen 9] Random Battle');

  await page.getByRole('button', { name: 'Select battle format' }).click();
  await page.getByRole('combobox', { name: 'Select battle format filter' }).fill('ou');
  await page.getByRole('option', { name: /\[Gen 9\] OU/ }).click();
  await expect(page.getByRole('button', { name: 'Select battle format' })).toContainText('[Gen 9] OU');
});

test('account dialog stays pending and shows nametaken errors', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Unnamed guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('TakenName');
  await page.getByRole('button', { name: /Choose name/i }).click();
  await expect(page.getByText('Waiting for server confirmation.')).toBeVisible();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('That name is already registered.')).toBeVisible();
  await expect(dialog).toBeVisible();
});

test('search creates a mock battle room and sends exact battle choices', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Unnamed guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: /Choose name/i }).click();
  await expect(page.getByRole('button', { name: /CodexTester/i })).toBeVisible();
  await page.getByRole('button', { name: /find battle/i }).click();

  await expect(page).toHaveURL(/\/battle\/battle-gen9ou-1/);
  await expect(page.locator('.battle-room-title')).toContainText('CodexTester');
  await expect(page.locator('.battle-room-title')).toContainText('MockRival');
  await expect(page.getByRole('button', { name: /Moonblast/i })).toBeVisible();
  await page.getByRole('button', { name: /Moonblast/i }).click();
  // The target picker names the Pokémon standing in each slot; empty slots
  // and the mover's own slot are disabled. Great Tusk (foe slot 1) is the
  // only legal target here, and picking it sends the protocol's +1.
  const target = page.getByRole('button', { name: /Great Tusk/i });
  await expect(target).toBeEnabled();
  await expect(page.locator('.target-button:disabled')).toHaveCount(3);
  await target.click();

  await expect.poll(async () => page.evaluate(() => (window as unknown as { __mockPsSent: string[] }).__mockPsSent.join('\n'))).toContain('battle-gen9ou-1|/choose move 1 +1|7');
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __mockPsSent: string[] }).__mockPsSent.join('\n'))).toContain('|/utm ');
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __mockPsSent: string[] }).__mockPsSent.join('\n'))).toContain('|/search gen9ou');
});

test('leaving a room leaves for real and lands on the directory', async ({ page }) => {
  await page.goto('/room/lobby');
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  await page.getByRole('button', { name: /Leave/ }).click();

  await expect(page).toHaveURL(/\/rooms/);
  await expect(page.locator('.session-tab')).toHaveCount(0);
  const sent = await page.evaluate(() => (window as unknown as { __mockPsSent: string[] }).__mockPsSent.join('\n'));
  expect(sent).toContain('lobby|/leave');
  // The old bug: the room surface auto-rejoined the moment you left.
  expect(sent).not.toContain('|/join lobby');
});

test('closing the active tab moves to the neighbouring tab', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Unnamed guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: /Choose name/i }).click();
  await page.getByRole('button', { name: /find battle/i }).click();
  await expect(page).toHaveURL(/\/battle\/battle-gen9ou-1/);

  // Lobby (joined at connect) and the battle are both open; closing the
  // active battle should land on the lobby tab, not dump to matchmaking.
  await page.getByRole('button', { name: 'Close CodexTester v MockRival' }).click();
  await expect(page).toHaveURL(/\/room\/lobby/);
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
});

test('teambuilder imports selects duplicates and deletes teams', async ({ page }) => {
  await page.goto('/teambuilder');
  await page.getByRole('button', { name: 'New team' }).first().click();
  await page.getByRole('textbox', { name: 'Team name' }).fill('Builder Test');
  await page.getByRole('textbox', { name: 'Team import text' }).fill('Raichu @ Light Ball\nAbility: Static\nTera Type: Electric\n- Thunderbolt');
  await page.getByRole('button', { name: 'Import and save' }).click();
  await expect(page.getByLabel('Saved teams').getByText('Builder Test', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Duplicate Builder Test' }).click();
  await expect(page.getByRole('button', { name: 'Duplicate Builder Test copy' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete Builder Test copy' }).click();
  await page.getByRole('button', { name: 'Delete team' }).click();
  await expect(page.getByRole('button', { name: 'Delete Builder Test copy' })).toHaveCount(0);

  await page.goto('/');
  await page.getByRole('button', { name: 'Select active team' }).click();
  await expect(page.getByRole('option', { name: /Builder Test/ })).toBeVisible();
});

test('loads every primary route directly without placeholder language', async ({ page }) => {
  const routes = [
    ['/', 'Ready when you are.'],
    ['/teambuilder', 'Teams'],
    ['/rooms', 'Rooms'],
    ['/ladder', 'Ladder'],
    ['/replays', 'Replays'],
    ['/settings', 'Settings'],
  ] as const;

  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByText(/preview|fixture/i)).toHaveCount(0);
  }
});

test('keeps mobile battle controls usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Unnamed guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: /Choose name/i }).click();
  await expect(page.getByRole('button', { name: /CodexTester/i })).toBeVisible();
  await page.getByRole('button', { name: /find battle/i }).click();
  await expect(page).toHaveURL(/\/battle\/battle-gen9ou-1/);
  await expect(page.getByRole('button', { name: /Moonblast/i })).toBeVisible();
  const logButton = page.getByRole('button', { name: 'Open battle log' });
  await expect(logButton).toBeVisible();
  const toolbarBounds = await page.locator('.battle-toolbar').boundingBox();
  const logButtonBounds = await logButton.boundingBox();
  expect(toolbarBounds).not.toBeNull();
  expect(logButtonBounds).not.toBeNull();
  expect((logButtonBounds?.x || 0) + (logButtonBounds?.width || 0)).toBeLessThanOrEqual((toolbarBounds?.x || 0) + (toolbarBounds?.width || 0));
  expect((logButtonBounds?.y || 0) + (logButtonBounds?.height || 0)).toBeLessThanOrEqual((toolbarBounds?.y || 0) + (toolbarBounds?.height || 0));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const decisionDeck = await page.locator('.decision-dock').boundingBox();
  expect(decisionDeck).not.toBeNull();
  expect((decisionDeck?.y || 0) + (decisionDeck?.height || 0)).toBeLessThanOrEqual(844 - 58);
});

test('provides keyboard access to the main workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /skip to workspace/i })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#workspace')).toBeFocused();
});

test('supports keyboard selection and command focus', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();
  await page.keyboard.press('/');
  await expect(page.getByRole('textbox', { name: 'Command search' })).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Select battle format' }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('random');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Select battle format' })).toContainText('Random Battle');
});

test('replay lab projects protocol events onto the shared battle field', async ({ page }) => {
  await page.goto('/replays');
  await page.getByRole('textbox', { name: 'Replay log input' }).fill([
    '|player|p1|Alice|',
    '|player|p2|Bob|',
    '|tier|Gen 9 OU',
    '|poke|p1|Pikachu, L80',
    '|poke|p2|Charizard, L80',
    '|switch|p1a: Pikachu|Pikachu, L80|100/100',
    '|switch|p2a: Charizard|Charizard, L80|75/100',
    '|turn|1',
  ].join('\n'));
  await page.getByRole('button', { name: 'Load replay' }).click();
  await page.getByRole('button', { name: 'Play replay' }).click();
  await expect(page.getByLabel('Battle field')).toContainText('Pikachu');
  await expect(page.getByLabel('Battle field')).toContainText('Charizard');
});

test('keeps source availability in settings', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: /source code/i })).toHaveAttribute(
    'href',
    'https://github.com/abhishekpradhan/pokemon-showdown-client'
  );
});
