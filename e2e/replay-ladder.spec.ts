import { expect, test } from './fixtures';
import { installMockPs } from './mock-ps';

const log = [
  '|gen|9',
  '|gametype|singles',
  '|player|p1|Alice|',
  '|player|p2|Bob|',
  '|tier|[Gen 9] OU',
  '|poke|p1|Pikachu|',
  '|poke|p2|Charizard|',
  '|start',
  '|switch|p1a: Pikachu|Pikachu|100/100',
  '|switch|p2a: Charizard|Charizard|100/100',
  '|turn|1',
  '|move|p1a: Pikachu|Thunderbolt|p2a: Charizard',
  '|-damage|p2a: Charizard|50/100',
  '|turn|2',
  '|move|p2a: Charizard|Flamethrower|p1a: Pikachu',
  '|-damage|p1a: Pikachu|50/100',
  '|turn|3',
  '|win|Alice',
].join('\n');

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
});

test('protected replay links retain their viewpoint and turn across reload', async ({ page }) => {
  await page.route('https://replay.pokemonshowdown.com/gen9ou-123-secretpw.json*', route =>
    route.fulfill({ json: { log, private: 2, format: '[Gen 9] OU', players: ['Alice', 'Bob'] } }),
  );
  const replay = 'https://replay.pokemonshowdown.com/gen9ou-123-secretpw';
  await page.goto(`/replays?replay=${encodeURIComponent(replay)}&turn=2&side=p2`);
  await expect(page.getByRole('spinbutton', { name: 'Go to turn' })).toHaveValue('2');
  await expect(page.getByText(/Protected replay link/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Original replay' })).toHaveAttribute('href', replay);
  await page.getByRole('button', { name: 'Next turn' }).click();
  await page.getByRole('button', { name: 'Switch sides' }).click();
  await expect(page).toHaveURL(/side=p1/);
  await page.getByRole('button', { name: 'Bookmark', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Go to turn' })).toHaveValue('3');
  await expect(page.getByRole('button', { name: 'Bookmarked', exact: true })).toBeVisible();
  await expect(page.locator('.replay-narration ol li')).not.toHaveCount(0);
  expect((await page.locator('.replay-canvas').boundingBox())!.height).toBeGreaterThanOrEqual(300);
  const previous = (await page.getByRole('button', { name: 'Previous turn' }).boundingBox())!;
  const play = (await page.getByRole('button', { name: 'Play replay' }).boundingBox())!;
  expect(previous.x + previous.width).toBeLessThanOrEqual(play.x);
  await page.screenshot({
    path: `/tmp/showdown-release-replay-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('ladder player lookup survives reload without altering matchmaking selection', async ({ page }) => {
  await page.route('https://pokemonshowdown.com/ladder/*.json*', route =>
    route.fulfill({
      json: { toplist: [{ username: 'Alice', elo: 1650, gxe: 70.2, rpr: 1800, rprd: 90, w: 12, l: 4 }] },
    }),
  );
  await page.route('https://pokemonshowdown.com/users/bob.json', route =>
    route.fulfill({
      json: {
        username: 'Bob',
        ratings: { gen9ou: { elo: 1150, gxe: 52.5, rpr: 1500, rprd: 125, w: 3, l: 2 } },
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Select battle format' }).click();
  await page.getByRole('option', { name: /\[Gen 9\] Random Battle/ }).click();
  await page.getByRole('link', { name: 'Ladder', exact: true }).click();
  await page.getByRole('button', { name: 'Select ladder format' }).click();
  await page.getByRole('option', { name: /\[Gen 9\] OU/ }).click();
  await expect(page.getByRole('button', { name: 'Alice', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Ladder player search' }).fill('Bob');
  await page.getByRole('checkbox', { name: 'Exact player', exact: true }).check();
  await page.getByRole('button', { name: 'Find player' }).click();
  await expect(page.getByRole('button', { name: 'Bob', exact: true })).toBeVisible();
  await expect(page.getByText('1500 ± 125')).toContainText('provisional');
  expect((await page.locator('.ladder-player-search').boundingBox())!.height).toBeLessThan(250);
  await page.screenshot({
    path: `/tmp/showdown-release-ladder-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select battle format' })).toContainText('Random Battle');
  await page.goBack();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Ladder player search' })).toHaveValue('Bob');
  await expect(page.getByRole('button', { name: 'Bob', exact: true })).toBeVisible();
});
