import { expect, test } from './fixtures';
import { installMockPs } from './mock-ps';

test('an old account profile update keeps the rename dialog pending until the requested identity arrives', async ({ page }) => {
  await installMockPs(page);
  await page.goto('/');
  await expect(page.getByText('Online', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const harness = window as unknown as {
      __mockPsSockets: Array<{ emit: (raw: string) => void; send: (raw: string) => void }>;
      releaseAssertion?: () => void; requestedNewIdentity?: boolean;
    };
    const socket = harness.__mockPsSockets[0];
    socket.emit('|updateuser| ArenaOld|1|lucas');
    const originalSend = socket.send.bind(socket);
    socket.send = raw => {
      if (raw.includes('/trn ArenaNew,')) { harness.requestedNewIdentity = true; return; }
      originalSend(raw);
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/action') && new URLSearchParams(String(init?.body)).get('userid') === 'arenanew') {
        return new Promise(resolve => { harness.releaseAssertion = () => resolve(new Response('synthetic-assertion')); });
      }
      return originalFetch(input, init);
    };
  });
  await page.getByRole('button', { name: 'ArenaOld', exact: true }).click();
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('ArenaNew');
  await page.getByRole('button', { name: 'Use guest name', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const emitOld = () => page.evaluate(() => (window as unknown as { __mockPsSockets: Array<{ emit: (raw: string) => void }> }).__mockPsSockets[0].emit('|updateuser| ArenaOld@!|1|dawn|{"language":"french"}'));
  await emitOld();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Playing as ArenaOld.');
  await expect(dialog.getByText('Waiting for server confirmation.', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Submitting…', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { releaseAssertion: () => void }).releaseAssertion());
  await page.waitForFunction(() => (window as unknown as { requestedNewIdentity: boolean }).requestedNewIdentity);
  await emitOld();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Submitting…', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { __mockPsSockets: Array<{ emit: (raw: string) => void }> }).__mockPsSockets[0].emit('|updateuser| ArenaNew|1|dawn'));
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ArenaNew', exact: true })).toBeFocused();
});
