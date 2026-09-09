import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { installMockPs } from './mock-ps';

const emit = async (page: Page, raw: string) => {
  await page.waitForFunction(
    () => (window as unknown as { __mockPsSockets?: unknown[] }).__mockPsSockets?.length,
  );
  await page.evaluate(
    line =>
      (
        window as unknown as { __mockPsSockets: Array<{ emit: (text: string) => void }> }
      ).__mockPsSockets[0].emit(line),
    raw,
  );
};
const directory = {
  chat: [
    { title: 'Lobby', desc: 'General discussion and help.', userCount: 345, section: 'Official' },
    {
      title: 'Competitive Tutoring',
      desc: 'Learn battle strategy with the community.',
      userCount: 137,
      section: 'Official',
    },
    { title: 'OverUsed', desc: 'Discuss the current OU metagame.', userCount: 278, section: 'Metagames' },
  ],
  sectionTitles: ['Official', 'Metagames'],
};

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
});

test('room browsing filters descriptions, saves without navigating, and explains invalid links', async ({
  page,
}) => {
  await page.goto('/rooms');
  await emit(page, `|queryresponse|rooms|${JSON.stringify(directory)}`);
  const filter = page.getByRole('textbox', { name: 'Filter rooms', exact: true });
  await filter.fill('strategy');
  await expect(page.locator('.directory-card')).toHaveCount(1);
  await expect(page.locator('.directory-card')).toContainText('Competitive Tutoring');
  await page.getByRole('button', { name: 'Clear room filter' }).click();
  await expect(filter).toBeFocused();
  await page.getByRole('button', { name: 'Favorite Lobby', exact: true }).click();
  await expect(page).toHaveURL(/\/rooms$/);
  await expect(page.getByRole('button', { name: 'Unfavorite Lobby', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const join = page.getByRole('textbox', { name: 'Room to join', exact: true });
  await join.fill('https://unrelated.example/lobby');
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(join).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toHaveText('Enter a room name or a Pokémon Showdown room link.');
  await join.fill('https://play.pokemonshowdown.com/lobby/?from=shared');
  await expect(join).toHaveAttribute('aria-invalid', 'false');
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page).toHaveURL(/\/room\/lobby$/);
});

test('compact directory and conversation controls fit narrow widths', async ({ page }, testInfo) => {
  await page.goto('/rooms');
  await emit(page, `|queryresponse|rooms|${JSON.stringify(directory)}`);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const selector of [
      '.directory-tools',
      '.directory-join input',
      '.directory-join button',
      '.directory-room-entry',
      '.directory-favorite',
    ]) {
      const bounds = await page.locator(selector).first().boundingBox();
      expect(bounds, selector).not.toBeNull();
      expect(bounds!.x, selector).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width, selector).toBeLessThanOrEqual(width);
    }
    const favorite = await page.locator('.directory-favorite').first().boundingBox();
    expect(favorite!.width).toBeGreaterThanOrEqual(40);
    expect(favorite!.height).toBeGreaterThanOrEqual(40);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('community-directory-mobile.png') });
  await page.goto('/room/pm-bob');
  await expect(page.getByRole('heading', { name: 'bob', exact: true })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const heading = await page.locator('.room-surface-heading').boundingBox();
    expect(heading!.height).toBeLessThan(92);
    const composer = await page.locator('.chat-composer').boundingBox();
    expect(composer!.x + composer!.width).toBeLessThanOrEqual(width);
    await expect(page.getByRole('textbox', { name: 'Message bob', exact: true })).toBeInViewport();
  }
});

test('user search stays separate from message search and conversation view state resets', async ({
  page,
}) => {
  await page.goto('/room/lobby');
  const history = page.getByRole('searchbox', { name: 'Search chat history', exact: true });
  await history.fill('Welcome');
  await page.getByRole('button', { name: '2 users', exact: true }).click();
  const userSearch = page.getByRole('searchbox', { name: 'Search room users', exact: true });
  await userSearch.fill('Driver');
  await expect(history).toHaveValue('Welcome');
  await expect(page.getByText('Welcome to the mock lobby.', { exact: true })).toBeVisible();
  await history.fill('does-not-exist');
  await expect(page.getByText('No messages match your search.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close user list' }).click();
  await expect(page.getByRole('button', { name: '2 users', exact: true })).toBeFocused();
  await page.getByRole('textbox', { name: 'Message Lobby', exact: true }).fill('Lobby draft survives');
  await emit(
    page,
    `|pm| Bob| Guest 1000|Hello\n${Array.from({ length: 100 }, (_, index) => `|pm| Bob| Guest 1000|Bob line ${index}`).join('\n')}`,
  );
  await page.locator('.session-tab-open').filter({ hasText: 'Bob' }).click();
  await expect(history).toHaveValue('');
  await expect(userSearch).toHaveCount(0);
  await expect(page.getByText('Bob line 99', { exact: true })).toBeInViewport();
  await page.locator('.session-tab-open').filter({ hasText: 'Lobby' }).click();
  await expect(history).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Message Lobby', exact: true })).toHaveValue(
    'Lobby draft survives',
  );
});

test('multiline drafts grow, survive failed sends, and return focus after success', async ({
  page,
}, testInfo) => {
  await page.goto('/room/pm-bob');
  const draft = page.getByRole('textbox', { name: 'Message bob', exact: true });
  const initialViewport = page.viewportSize();
  await page.setViewportSize({ width: 1440, height: 900 });
  await draft.fill('A longer draft that wraps naturally when the conversation becomes narrow.');
  await page.setViewportSize({ width: 320, height: 844 });
  await expect.poll(() => draft.evaluate(field => field.clientHeight)).toBeGreaterThan(65);
  expect(await draft.evaluate(field => field.scrollHeight - field.clientHeight)).toBeLessThanOrEqual(1);
  if (initialViewport) await page.setViewportSize(initialViewport);
  const text = 'First draft line\nSecond draft line\nThird draft line';
  await draft.fill(text);
  expect(await draft.evaluate(field => field.clientHeight)).toBeGreaterThan(65);
  expect(await draft.evaluate(field => field.scrollHeight - field.clientHeight)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(draft).toHaveValue(text);
  await expect(draft).toBeFocused();
  await expect(page.getByText('Message was not sent. Your draft is kept here.')).toBeVisible();
  await draft.fill('Revised draft');
  await expect(page.getByText('Message was not sent. Your draft is kept here.')).toHaveCount(0);
  await page.reload();
  await expect(draft).toHaveValue('Revised draft');
  await emit(page, '|updateuser| CodexTester|1|0');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(draft).toHaveValue('');
  await expect(draft).toBeFocused();
  await draft.fill(text);
  await page.screenshot({ path: testInfo.outputPath('community-pm-draft.png') });
});

test('Tab completion respects the caret and does not trap focus on complete commands', async ({ page }) => {
  await page.goto('/room/lobby');
  const draft = page.getByRole('textbox', { name: 'Message Lobby', exact: true });
  await draft.fill('/he suffix');
  await draft.evaluate(field => (field as HTMLTextAreaElement).setSelectionRange(3, 3));
  await draft.press('Tab');
  await expect(draft).toHaveValue('/help suffix');
  await expect.poll(() => draft.evaluate(field => (field as HTMLTextAreaElement).selectionStart)).toBe(5);
  await draft.press('Tab');
  await expect(draft).not.toBeFocused();
  await draft.fill('hello Driver');
  await draft.evaluate(field => (field as HTMLTextAreaElement).setSelectionRange(2, 2));
  await draft.press('Tab');
  await expect(draft).toHaveValue('hello Driver');
  await expect(draft).not.toBeFocused();
});

test('spoilers can be revealed and hidden by touch or keyboard', async ({ page, isMobile }) => {
  await page.goto('/room/lobby');
  await emit(page, '>lobby\n|c|Reader|The answer is ||Pikachu||.');
  const spoiler = page.getByRole('button', { name: 'Reveal spoiler', exact: true });
  await expect(spoiler).toHaveAttribute('aria-expanded', 'false');
  if (isMobile) await spoiler.tap();
  else await spoiler.click();
  const revealed = page.getByRole('button', { name: 'Hide spoiler: Pikachu', exact: true });
  await expect(revealed).toHaveAttribute('aria-expanded', 'true');
  await revealed.press('Space');
  await expect(spoiler).toHaveAttribute('aria-expanded', 'false');
});
