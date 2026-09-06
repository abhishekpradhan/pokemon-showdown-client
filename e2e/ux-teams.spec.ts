import { expect, test } from './fixtures';
import { installMockPs } from './mock-ps';

test.beforeEach(async ({ page }) => { await installMockPs(page); });

test('adding a Pokémon opens a usable editor and preserves its complete set', async ({ page }) => {
  await page.goto('/teambuilder');
  await page.getByRole('button', { name: 'New team', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Team name', exact: true }).fill('Practice team');
  await expect(page.getByRole('button', { name: 'Add Pokémon', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Add Pokémon', exact: true }).click();
  const species = page.getByRole('button', { name: 'Species', exact: true });
  await expect(species).toBeFocused();
  await expect(species).toBeInViewport();
  expect(await page.locator('.team-toolbar').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await expect(page.getByRole('button', { name: 'Move 1', exact: true })).toContainText('Move 1');
  await species.click();
  await page.getByRole('combobox', { name: /filter$/ }).fill('Pikachu');
  await page.getByRole('option', { name: /^Pikachu\s*#25$/ }).click();
  await page.getByRole('button', { name: 'Move 1', exact: true }).click();
  await page.getByRole('combobox', { name: /filter$/ }).fill('Thunderbolt');
  await page.getByRole('option', { name: /^Thunderbolt/ }).click();
  await page.getByRole('button', { name: 'Fast special', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'SpA EV', exact: true })).toHaveValue('252');
  await page.getByText('IVs and calculated stats', { exact: true }).click();
  await page.getByRole('button', { name: 'Minimum Attack', exact: true }).click();
  await page.getByText('Set details', { exact: true }).click();
  await page.getByLabel('Gender', { exact: true }).selectOption('F');
  await page.getByLabel('Happiness', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Save as new team', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save team', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Team name', exact: true })).toHaveValue('Practice team');
  await page.getByRole('button', { name: 'Edit Pikachu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move 1', exact: true })).toContainText('Thunderbolt');
  await expect(page.getByRole('spinbutton', { name: 'SpA EV', exact: true })).toHaveValue('252');
  await page.getByText('IVs and calculated stats', { exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Atk IV', exact: true })).toHaveValue('0');
  await page.getByText('Set details', { exact: true }).click();
  await expect(page.getByLabel('Gender', { exact: true })).toHaveValue('F');
  await expect(page.getByLabel('Happiness', { exact: true })).toHaveValue('0');
  await page.screenshot({ path: `/tmp/teams-ux-verified-editor-${test.info().project.name}.png`, fullPage: true });
});

test('removing a Pokémon can be undone without losing its set', async ({ page }) => {
  await page.goto('/teambuilder');
  await page.getByRole('button', { name: 'Remove Dragapult', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Dragapult', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Species', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Move 1', exact: true })).toContainText('Shadow Ball');
  await expect(page.getByRole('button', { name: 'Held item', exact: true })).toContainText('Choice Specs');
  await page.getByRole('button', { name: 'Team overview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Dragapult', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit Dragapult', exact: true })).toBeVisible();
  await page.screenshot({ path: `/tmp/teams-ux-verified-overview-${test.info().project.name}.png`, fullPage: true });
});

test('the library and recovered drafts remain reachable while switching teams', async ({ page }) => {
  await page.goto('/teambuilder');
  await page.getByRole('textbox', { name: 'Team name', exact: true }).fill('Unfinished edits');
  await page.getByRole('button', { name: 'New team', exact: true }).first().click();
  await expect(page.getByRole('textbox', { name: 'Team name', exact: true })).toHaveValue('');
  const library = page.getByRole('button', { name: /Team library/ });
  if (await library.isVisible()) {
    await expect(library).toHaveAttribute('aria-expanded', 'false');
    await library.click();
    await expect(library).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(page.getByRole('button', { name: 'Backup / restore library', exact: true })).toBeVisible();
  await page.getByText(/Recover drafts \/ deleted teams/).click();
  await page.getByRole('button', { name: 'Unfinished edits', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Team name', exact: true })).toHaveValue('Unfinished edits');
  await expect(page.getByRole('button', { name: 'Edit Dragapult', exact: true })).toBeVisible();
  if (await library.isVisible()) await expect(library).toHaveAttribute('aria-expanded', 'false');
});

test('a delayed Pokédex does not interrupt typing in another field', async ({ page }) => {
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(/@pkmn_dex/, async route => { await pending; await route.continue(); });
  try {
    // The intentionally stalled module participates in load on WebKit and
    // Firefox. Wait for the rendered controls while that request is held.
    await page.goto('/teambuilder', { waitUntil: 'commit' });
    await page.getByRole('button', { name: 'Add Pokémon', exact: true }).click();
    await expect(page.getByText('Loading Pokédex…', { exact: true })).toBeVisible();
    const name = page.getByRole('textbox', { name: 'Team name', exact: true });
    await name.fill('Keep typing here');
    release();
    await expect(page.getByRole('button', { name: 'Species', exact: true })).toBeVisible();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(name).toBeFocused();
    await expect(name).toHaveValue('Keep typing here');
  } finally { release(); }
});

test('offline editing stays informative and saves locally without masking save errors', async ({ page }) => {
  const socketEvent = async (type: 'error' | 'open') => {
    await page.evaluate(eventType => {
      const socket = (window as unknown as { __mockPsSockets: Array<{ onerror: ((event: Event) => void) | null; onopen: ((event: Event) => void) | null }> }).__mockPsSockets[0];
      if (eventType === 'error') socket.onerror?.(new Event('error'));
      else socket.onopen?.(new Event('open'));
    }, type);
  };
  await page.goto('/teambuilder');
  const validate = page.getByRole('button', { name: 'Validate with server', exact: true });
  await expect(validate).toBeEnabled();
  await socketEvent('error');
  const offline = page.getByRole('status').filter({ hasText: 'Live server connection unavailable. You can still edit and save teams in this browser.' });
  await expect(offline).toBeVisible();
  await expect(offline).toHaveClass(/is-info/);
  await expect(page.getByText('WebSocket error', { exact: true })).toHaveCount(0);
  await expect(validate).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath('offline-team-status.png'), fullPage: true });

  const name = page.getByRole('textbox', { name: 'Team name', exact: true });
  const save = page.getByRole('button', { name: 'Save team', exact: true });
  await name.fill('Offline practice');
  await save.click();
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(name).toHaveValue('Offline practice');
  await expect(save).toBeDisabled();
  await expect(validate).toBeEnabled();

  // A recovered connection must hide the generic error still held in the store.
  await socketEvent('error');
  await expect(offline).toBeVisible();
  await socketEvent('open');
  await expect(validate).toBeEnabled();
  await expect(offline).toHaveCount(0);
  await expect(page.getByText('WebSocket error', { exact: true })).toHaveCount(0);

  // Fail only the saved library write; draft recovery remains available.
  await socketEvent('error');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'ps-modern-teams-v1') throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await name.fill('Unsaved offline edits');
  await save.click();
  const error = page.getByRole('alert').filter({ hasText: 'Could not save to browser storage. Your edits remain open; export a backup or free storage and retry.' });
  await expect(error).toBeVisible();
  await expect(error).toHaveClass(/is-error/);
  await expect(offline).toHaveCount(0);
  await expect(name).toHaveValue('Unsaved offline edits');
  await expect(save).toBeEnabled();
});
