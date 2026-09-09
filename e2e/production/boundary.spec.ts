import { expect, test } from '@playwright/test';
import { installMockPs } from '../mock-ps';

test('deployed handlers reject unsafe inputs and expose production headers', async ({ request, baseURL }) => {
  // Browsers send Origin on every POST; the proxies require it to match ours.
  const sameOrigin = { Origin: new URL(baseURL!).origin };
  const notices = await request.get('/THIRD_PARTY_NOTICES.txt');
  expect(notices.ok()).toBe(true);
  expect(await notices.text()).toContain('BattleStatGuesser');
  const shell = await request.get('/');
  const csp = shell.headers()['content-security-policy'];
  expect(csp).toContain("script-src 'self';");
  expect(csp).toContain('wss: ws:');
  expect(csp).toContain("frame-ancestors 'none'");
  expect((await request.get('/api/action')).status()).toBe(405);
  expect(
    (
      await request.post('/api/action', {
        data: '{}',
        headers: { ...sameOrigin, 'Content-Type': 'application/json' },
      })
    ).status(),
  ).toBe(415);
  expect((await request.post('/api/action', { form: { act: 'login' }, headers: sameOrigin })).status()).toBe(
    400,
  );
  const noOrigin = await request.post('/api/action', {
    form: { act: 'getassertion', userid: 'alice', challstr: '4|test' },
  });
  expect(noOrigin.status()).toBe(403);
  const crossOrigin = await request.post('/api/replay', {
    form: { id: 'test', log: '|turn|1' },
    headers: { Origin: 'https://another.example' },
  });
  expect(crossOrigin.status()).toBe(403);
  expect(crossOrigin.headers()['cache-control']).toBe('no-store');
  expect(
    (
      await request.post('/api/replay', { form: { id: '../bad', log: '|turn|1' }, headers: sameOrigin })
    ).status(),
  ).toBe(400);
  const info = await (await request.get('/build-info.json')).json();
  expect(info.source).toContain('/tree/');
  expect(info.revision).toMatch(/^[a-f0-9]{40}$/);
});

test('OAuth callback stays separate under CSP and cannot replace the offline team editor', async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /Content Security Policy|violates.*directive/i.test(message.text()))
      errors.push(message.text());
  });
  await installMockPs(page);
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(resolve =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }),
      );
    }
  });
  const callback = await context.newPage();
  const response = await callback.goto(
    '/oauth.html?state=synthetic-state&assertion=synthetic-assertion&token=synthetic-token&user=Alice',
  );
  expect(response?.headers()['cache-control']).toBe('no-store');
  await expect(callback).toHaveURL(/\/oauth.html$/);
  expect(await callback.evaluate(() => window.name)).toContain('ps-oauth:?state=synthetic-state');
  await expect(callback.getByRole('paragraph')).toContainText('original window');
  await callback.close();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Teams', exact: true })).toBeVisible();
  await page
    .getByRole('complementary', { name: 'Saved teams' })
    .getByLabel('New team', { exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: 'Team name', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Team name', exact: true }).fill('Offline regression team');
  await page.getByRole('button', { name: 'Add Pokémon', exact: true }).first().click();
  await page.getByRole('button', { name: 'Species', exact: true }).click();
  await page.getByRole('combobox', { name: 'Species filter', exact: true }).fill('Pikachu');
  await page.getByRole('option', { name: 'Pikachu #25', exact: true }).click();
  await page.getByRole('button', { name: 'Move 1', exact: true }).click();
  await page.getByRole('combobox', { name: 'Move 1 filter', exact: true }).fill('Thunderbolt');
  await page
    .getByRole('option')
    .filter({ has: page.getByText('Thunderbolt', { exact: true }) })
    .click();
  await page.getByRole('button', { name: 'Save as new team', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Team name', exact: true })).toHaveValue(
    'Offline regression team',
  );
  await page.getByRole('button', { name: 'Edit Pikachu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move 1', exact: true })).toContainText('Thunderbolt');
  await expect(page.getByText('Finishing sign-in…')).toHaveCount(0);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('offline-team-editor.png'), fullPage: true });
  expect(errors).toEqual([]);
});
