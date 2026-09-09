import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';

test('native worker updates wait, reject incomplete installs and retain exactly one prior release', async ({
  page,
  context,
}) => {
  let revision = 'first';
  const template = readFileSync('public/sw.js', 'utf8');
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/sw.js') {
      response.setHeader('Content-Type', 'application/javascript');
      response.end(
        template.replace(
          /const BUILD = \/\* @arena-manifest \*\/ [\s\S]*?;/,
          `const BUILD = ${JSON.stringify({ revision, assets: ['/', `/assets/${revision}.js`] })};`,
        ),
      );
    } else if (request.url?.startsWith('/assets/')) {
      response.setHeader('Content-Type', 'application/javascript');
      response.statusCode = revision === 'incomplete' ? 503 : 200;
      response.end(`asset:${revision}`);
    } else {
      response.setHeader('Content-Type', 'text/html');
      response.end(
        `<html><head><meta name="arena-build" content="${revision}"></head><body>${revision}</body></html>`,
      );
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await page.goto(origin);
    await page.evaluate(async () => {
      await caches.open('unrelated-app');
      await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise<void>(resolve =>
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }),
        );
    });
    revision = 'incomplete';
    await page.evaluate(async () => {
      const registration = (await navigator.serviceWorker.getRegistration())!;
      await new Promise<void>((resolve, reject) => {
        registration.addEventListener(
          'updatefound',
          () => {
            const worker = registration.installing!;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'redundant') resolve();
              if (worker.state === 'installed')
                reject(new Error('Incomplete resources must reject installation'));
            });
          },
          { once: true },
        );
        void registration.update().catch(reject);
      });
    });
    await page.reload();
    await expect(page.locator('body')).toHaveText('first');
    expect(await page.evaluate(() => caches.keys())).toEqual(['unrelated-app', 'arena-build-first']);
    for (const next of ['second', 'third']) {
      revision = next;
      await page.evaluate(async () => {
        await (await navigator.serviceWorker.getRegistration())!.update();
      });
      await expect
        .poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting))
        .toBe(true);
      await expect(page.locator('body')).toHaveText(next === 'second' ? 'first' : 'second');
      await page.evaluate(async () => {
        const registration = (await navigator.serviceWorker.getRegistration())!;
        const activated = new Promise<void>(resolve =>
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }),
        );
        registration.waiting!.postMessage({ type: 'ARENA_APPLY_UPDATE' });
        await activated;
      });
      await page.reload();
      await expect(page.locator('body')).toHaveText(next);
    }
    expect(await page.evaluate(() => caches.keys())).toEqual([
      'unrelated-app',
      'arena-build-second',
      'arena-build-third',
    ]);
    await context.setOffline(true);
    await page.goto(`${origin}/teambuilder`);
    await expect(page.locator('body')).toHaveText('third');
    expect(await page.evaluate(async () => (await fetch('/assets/second.js')).text())).toBe('asset:second');
    expect(
      await page.evaluate(async () => {
        const channel = new MessageChannel();
        const response = new Promise(resolve => {
          channel.port1.onmessage = event => resolve(event.data);
        });
        navigator.serviceWorker.controller!.postMessage({ type: 'ARENA_OFFLINE_STATUS' }, [channel.port2]);
        return response;
      }),
    ).toEqual({ revision: 'third', ready: true });
  } finally {
    await context.setOffline(false);
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
