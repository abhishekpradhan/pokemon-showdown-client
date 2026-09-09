import { expect, test } from './fixtures';
import { installMockPs } from './mock-ps';

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
});

test('first battle action resolves naming without starting a search, and presets do not ask for a team', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Online', { exact: true })).toBeVisible();
  const action = page.locator('.queue-action');
  await expect(action).toHaveText('Choose name');
  expect((await action.boundingBox())!.y).toBeLessThan(500);
  await action.click();
  const name = page.getByRole('textbox', { name: 'Username', exact: true });
  await expect(name).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(action).toBeFocused();
  await action.click();
  await name.fill('ArenaTester');
  await page.getByRole('button', { name: 'Use guest name', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(action).toHaveText('Find battle');
  const sent = await page.evaluate(
    () => JSON.parse(localStorage.getItem('__mockPsSent') || '[]') as string[],
  );
  expect(sent.some(message => message.includes('/search '))).toBe(false);
  await page.getByRole('button', { name: 'Select battle format', exact: true }).click();
  await page.getByRole('option', { name: /Random Battle/ }).click();
  await expect(page.getByRole('button', { name: 'Select active team' })).toHaveCount(0);
  await expect(page.getByText('Provided when the battle starts')).toBeVisible();
  await expect(action).toBeEnabled();
});

test('a failed rename keeps the account dialog and error visible for an already named player', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Unnamed guest', exact: true }).click();
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('ArenaTester');
  await page.getByRole('button', { name: 'Use guest name', exact: true }).click();
  const account = page.getByRole('button', { name: 'ArenaTester', exact: true });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await account.click();
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('TakenName');
  await page.getByRole('button', { name: 'Use guest name', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('already registered');
  await expect(page.getByRole('textbox', { name: 'Username', exact: true })).toHaveValue('TakenName');
  await page.keyboard.press('Escape');
  await expect(account).toBeFocused();
});

test('notifications dismiss with Escape and outside interaction, restoring keyboard focus', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Notifications', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Updates', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await page.getByRole('heading', { name: 'Find a battle', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Updates', exact: true })).toHaveCount(0);
});

test('search announces the active result, clears dismissed filters and returns focus to its opener', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Search', exact: true });
  await trigger.click();
  const input = page.getByRole('combobox', { name: 'Search commands' });
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-activedescendant', /page-/);
  await input.fill('!!!');
  await expect(page.getByRole('listbox', { name: 'Results' }).getByRole('option')).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(input).toHaveValue('');
  await input.fill('settings');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator('#workspace')).toBeFocused();
});

test('conversation and spectating routes have accurate navigation context', async ({ page }) => {
  await page.goto('/room/lobby');
  await expect(page.locator('.workspace-context strong')).toHaveText('Lobby');
  await expect(
    page
      .getByRole('navigation', { name: 'Primary', exact: true })
      .getByRole('link', { name: 'Rooms', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.goto('/battles');
  await expect(page.locator('.workspace-context strong')).toHaveText('Live battles');
  await expect(
    page
      .getByRole('navigation', { name: 'Primary', exact: true })
      .getByRole('link', { name: 'Battle', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('an empty replay starts with reachable loading controls and only shows playback after loading', async ({
  page,
}) => {
  await page.goto('/replays');
  await expect(page.getByRole('button', { name: 'Play replay', exact: true })).toHaveCount(0);
  const source = page.getByRole('textbox', { name: 'Replay log input' });
  expect((await source.boundingBox())!.y).toBeLessThan(450);
  const load = page.getByRole('button', { name: 'Load replay', exact: true });
  await expect(load).toBeDisabled();
  await source.fill(
    '|gen|9\n|gametype|singles\n|player|p1|Alice|\n|player|p2|Bob|\n|tier|[Gen 9] OU\n|start\n|switch|p1a: Pikachu|Pikachu|100/100\n|switch|p2a: Charizard|Charizard|100/100\n|turn|1\n|win|Alice',
  );
  await load.click();
  await expect(page.getByRole('button', { name: 'Play replay', exact: true })).toBeVisible();
  await expect(page.locator('.replay-stage')).toBeFocused();
  expect((await page.locator('.replay-stage').boundingBox())!.y).toBeLessThan(150);
});

test('settings section links reveal and focus the requested section', async ({ page }) => {
  await page.goto('/settings');
  await page
    .getByRole('navigation', { name: 'Settings sections' })
    .getByRole('link', { name: 'Connection', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Connection', exact: true })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Server address' })).toBeInViewport();
  expect(
    (await page.getByRole('heading', { name: 'Connection', exact: true }).boundingBox())!.y,
  ).toBeLessThan(200);
});

test('opening Settings from the account dialog focuses the destination instead of the old opener', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Unnamed guest', exact: true }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#workspace')).toBeFocused();
});

test('a delayed replay does not take focus from a new source being typed', async ({ page }) => {
  let release: () => void = () => {};
  const responseReady = new Promise<void>(resolve => {
    release = resolve;
  });
  let requested: () => void = () => {};
  const requestStarted = new Promise<void>(resolve => {
    requested = resolve;
  });
  await page.route('https://replay.pokemonshowdown.com/gen9ou-123.json*', async route => {
    requested();
    await responseReady;
    await route.fulfill({
      json: {
        log: '|gen|9\n|gametype|singles\n|player|p1|Alice|\n|player|p2|Bob|\n|start\n|turn|1\n|win|Alice',
        players: ['Alice', 'Bob'],
        format: '[Gen 9] OU',
      },
    });
  });
  await page.goto('/replays');
  const source = page.getByRole('textbox', { name: 'Replay log input' });
  await source.fill('gen9ou-123');
  await page.getByRole('button', { name: 'Load replay', exact: true }).click();
  await requestStarted;
  await source.fill('gen9ou-456');
  release();
  await expect(page.locator('.replay-workspace')).toHaveClass(/has-replay/);
  await expect(source).toBeFocused();
  await expect(source).toHaveValue('gen9ou-456');
});

test('search opens the chosen saved team while already building and preserves the previous draft', async ({
  page,
}) => {
  await page.goto('/teambuilder');
  await page.getByRole('button', { name: 'New team', exact: true }).first().click();
  const name = page.getByRole('textbox', { name: 'Team name', exact: true });
  await name.fill('Other team');
  await page.getByRole('button', { name: 'Save as new team', exact: true }).click();
  await expect(page).toHaveURL(/team=/);
  const savedUrl = page.url();
  await name.fill('Other unfinished edits');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search commands' }).fill('Arena sample');
  await page.getByRole('option', { name: /Arena sample/ }).click();
  await expect(name).toHaveValue('Arena sample');
  await expect(page).not.toHaveURL(savedUrl);
  await expect(page.getByRole('button', { name: 'Edit Iron Valiant', exact: true })).toBeVisible();
  await expect(page.locator('#workspace')).toBeFocused();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search commands' }).fill('Other team');
  await page.getByRole('option', { name: /Other team/ }).click();
  await expect(page).toHaveURL(savedUrl);
  await expect(name).toHaveValue('Other unfinished edits');
});
