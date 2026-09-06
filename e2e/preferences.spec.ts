import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { installMockPs } from './mock-ps';

const sent = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('__mockPsSent') || '[]') as string[]);
const updateUser = (page: Page, avatar = '1', language = 'english') => page.evaluate(({ avatar, language }) => {
  (window as unknown as { __mockPsSockets: Array<{ emit: (line: string) => void }> }).__mockPsSockets[0].emit(`|updateuser| PreferenceTester|1|${avatar}|${JSON.stringify({ language })}`);
}, { avatar, language });

async function namedSettings(page: Page) {
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Disconnect', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const socket = (window as unknown as { __mockPsSockets: Array<{ emit: (line: string) => void }> }).__mockPsSockets[0];
    const emit = socket.emit.bind(socket);
    // The generic mock returns an unrelated default avatar for user cards.
    // Control our own structured response so delayed/missing ACKs stay testable.
    socket.emit = line => {
      if (line.startsWith('|queryresponse|userdetails|') && JSON.parse(line.slice('|queryresponse|userdetails|'.length)).userid === 'preferencetester') return;
      emit(line);
    };
    (window as unknown as { __emitProfileFixture: (line: string) => void }).__emitProfileFixture = emit;
  });
  await updateUser(page);
  await expect(page.getByText('Profile preferences are in sync.', { exact: true })).toBeVisible();
}

const confirmAvatarDetails = (page: Page, avatar: string, userid = 'preferencetester') => page.evaluate(({ avatar, userid }) => {
  (window as unknown as { __emitProfileFixture: (line: string) => void }).__emitProfileFixture(`|queryresponse|userdetails|${JSON.stringify({ userid, avatar, rooms: {} })}`);
}, { avatar, userid });

async function backgroundFile(page: Page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 4;
    const context = canvas.getContext('2d')!; context.fillStyle = '#3060a0'; context.fillRect(0, 0, 4, 4);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name: 'test-background.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}

test.beforeEach(async ({ page }) => { await installMockPs(page); });

test('avatar preview applies only on confirmation and waits for server acknowledgement', async ({ page }) => {
  await namedSettings(page);
  const choose = page.getByRole('button', { name: 'Choose avatar', exact: true });
  const currentAvatar = page.getByRole('img', { name: 'Current trainer avatar' });
  await expect(currentAvatar).toHaveAttribute('src', /\/lucas\.png$/);
  await choose.click();
  const dialog = page.getByRole('dialog', { name: 'Choose an avatar' });
  await dialog.getByRole('textbox', { name: 'Search avatars' }).fill('dawn');
  await dialog.getByRole('button', { name: 'dawn', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'dawn', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect((await sent(page)).some(line => line.includes('/avatar'))).toBe(false);
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect((await new AxeBuilder({ page }).include('.avatar-dialog').analyze()).violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('avatar-picker.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(choose).toBeFocused();
  expect((await sent(page)).some(line => line.includes('/avatar'))).toBe(false);
  await choose.click();
  await dialog.getByRole('textbox', { name: 'Search avatars' }).fill('dawn');
  await dialog.getByRole('button', { name: 'dawn', exact: true }).click();
  await dialog.getByRole('button', { name: 'Apply avatar', exact: true }).click();
  await expect(choose).toBeFocused();
  await expect.poll(() => sent(page)).toContain('|/avatar dawn');
  await expect.poll(() => sent(page)).toContain('|/query userdetails preferencetester');
  // The queued alias must follow /avatar; /cmd userdetails can overtake it on
  // real servers because that spelling is exempt from command throttling.
  expect((await sent(page)).filter(line => /\/(?:avatar|query|cmd userdetails) /.test(line))).toEqual([
    '|/avatar dawn', '|/query userdetails preferencetester',
  ]);
  await page.evaluate(() => (window as unknown as { __emitProfileFixture: (line: string) => void }).__emitProfileFixture('|pm|~|PreferenceTester|/raw <img src="https://play.pokemonshowdown.com/sprites/trainers/dawn.png" />'));
  await confirmAvatarDetails(page, '2', 'someoneelse');
  await expect(currentAvatar).toHaveAttribute('src', /\/lucas\.png$/);
  await expect(page.getByText('Applying preferences…', { exact: true })).toBeVisible();
  await confirmAvatarDetails(page, '2');
  await expect(currentAvatar).toHaveAttribute('src', /\/dawn\.png$/);
  await expect(page.getByText('Profile preferences are in sync.', { exact: true })).toBeVisible();
  await page.getByLabel('Server language', { exact: true }).selectOption('spanish');
  await expect.poll(() => sent(page)).toContain('|/language spanish');
  await expect(page.getByText(/Arena’s interface remains in English/)).toBeVisible();
  await updateUser(page, '2', 'spanish');
  await expect(page.getByText('Profile preferences are in sync.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Server language', { exact: true })).toHaveValue('spanish');
  await expect(page.getByText(/Saved avatar: dawn\./)).toBeVisible();
});

test('unacknowledged avatar preferences offer a retry without claiming success', async ({ page }) => {
  await page.clock.install();
  await namedSettings(page);
  await page.getByRole('button', { name: 'Choose avatar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose an avatar' });
  await dialog.getByRole('textbox', { name: 'Search avatars' }).fill('dawn');
  await dialog.getByRole('button', { name: 'dawn', exact: true }).click();
  await dialog.getByRole('button', { name: 'Apply avatar', exact: true }).click();
  await expect.poll(() => sent(page)).toContain('|/avatar dawn');
  // Reapplying the saved choice before an ACK must actually retry the command.
  await page.getByRole('button', { name: 'Choose avatar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Apply avatar', exact: true }).click();
  await expect.poll(async () => (await sent(page)).filter(line => line === '|/avatar dawn').length).toBe(2);
  await page.clock.fastForward(10_001);
  await expect(page.getByText('The server has not confirmed these preferences. Try again, or check your connection.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry profile preferences', exact: true }).click();
  await expect.poll(async () => (await sent(page)).filter(line => line === '|/avatar dawn').length).toBe(3);
  await expect.poll(async () => (await sent(page)).filter(line => line === '|/query userdetails preferencetester').length).toBe(3);
  await confirmAvatarDetails(page, '2');
  await expect(page.getByText('Profile preferences are in sync.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry profile preferences', exact: true })).toHaveCount(0);
});

test('background choices and a locally stored image survive reload and can be removed', async ({ page }) => {
  await page.goto('/settings');
  const background = page.getByLabel('Background', { exact: true });
  await background.selectOption('ocean');
  await expect(page.locator('html')).toHaveAttribute('data-background', 'ocean');
  await page.reload();
  await expect(background).toHaveValue('ocean');
  await page.getByLabel('Background image', { exact: true }).setInputFiles(await backgroundFile(page));
  await expect(page.getByText('Background saved in this browser.', { exact: true })).toBeVisible();
  await expect(background).toHaveValue('custom');
  await expect.poll(() => page.locator('html').evaluate(element => (element as HTMLElement).style.getPropertyValue('--arena-background-image'))).toMatch(/blob:/);
  await page.reload();
  await expect(background).toHaveValue('custom');
  await expect.poll(() => page.locator('html').evaluate(element => (element as HTMLElement).style.getPropertyValue('--arena-background-image'))).toMatch(/blob:/);
  await page.getByRole('button', { name: 'Remove stored image', exact: true }).click();
  await expect(page.getByText('Your stored image was removed.', { exact: true })).toBeVisible();
  await expect(background).toHaveValue('none');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove stored image', exact: true })).toHaveCount(0);
  await background.selectOption('forest');
  await page.getByLabel('Background image', { exact: true }).setInputFiles({ name: 'not-an-image.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByText('Choose a PNG, JPEG or WebP image.', { exact: true })).toBeVisible();
  await expect(background).toHaveValue('forest');
  await page.getByLabel('Background image', { exact: true }).setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('invalid pixels') });
  await expect(page.getByText('This image could not be opened. Try another PNG, JPEG or WebP.', { exact: true })).toBeVisible();
  await expect(background).toHaveValue('forest');
});

test('background storage failures remain recoverable and preserve the chosen background', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('Background', { exact: true }).selectOption('dusk');
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () { throw new DOMException('Test storage quota exceeded', 'QuotaExceededError'); };
  });
  await page.getByLabel('Background image', { exact: true }).setInputFiles(await backgroundFile(page));
  await expect(page.getByText(/Test storage quota exceeded|could not be stored|Free some browser storage/)).toBeVisible();
  await expect(page.getByLabel('Background image', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('Background', { exact: true })).toHaveValue('dusk');
});

test('audio levels and master mute persist independently', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Audio', exact: true }).click();
  await page.getByRole('slider', { name: 'Effects volume', exact: true }).fill('23');
  await page.getByRole('slider', { name: 'Notification volume', exact: true }).fill('41');
  await page.getByRole('slider', { name: 'Music volume', exact: true }).fill('65');
  await page.getByRole('switch', { name: 'Battle music', exact: true }).check();
  await page.getByLabel('Music track', { exact: true }).selectOption('xy-trainer');
  await page.getByRole('switch', { name: 'Battle sounds', exact: true }).uncheck();
  await expect(page.getByRole('button', { name: 'Test notification sound', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('slider', { name: 'Effects volume', exact: true })).toHaveValue('23');
  await expect(page.getByRole('slider', { name: 'Notification volume', exact: true })).toHaveValue('41');
  await expect(page.getByRole('slider', { name: 'Music volume', exact: true })).toHaveValue('65');
  await expect(page.getByRole('switch', { name: 'Battle music', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Battle sounds', exact: true })).not.toBeChecked();
  await expect(page.getByLabel('Music track', { exact: true })).toHaveValue('xy-trainer');
  await page.getByRole('switch', { name: 'Battle sounds', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Test notification sound', exact: true })).toBeEnabled();
  await page.getByRole('slider', { name: 'Notification volume', exact: true }).fill('0');
  await expect(page.getByRole('button', { name: 'Test notification sound', exact: true })).toBeDisabled();
  expect(await page.locator('.settings-page').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.getByRole('link', { name: 'Audio', exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('audio-settings.png'), fullPage: true });
});
