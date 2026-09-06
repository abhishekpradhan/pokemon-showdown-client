// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const template = readFileSync('public/sw.js', 'utf8');
const origin = 'https://arena.example';
const shell = '<html><meta name="arena-build" content="new"><div id="root">APP SHELL</div></html>';

type WorkerEvent = {
  request?: { url: string; method: string; mode: string };
  data?: { type: string };
  waitUntil?: (promise: Promise<unknown>) => void;
  respondWith?: (promise: Promise<Response>) => void;
};
function worker(options: { quota?: boolean; mismatchedShell?: boolean } = {}) {
  const stores = new Map<string, Map<string, Response>>();
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  let skipped = false;
  let claimed = false;
  const caches = {
    async keys() { return [...stores.keys()]; },
    async delete(key: string) { return stores.delete(key); },
    async open(key: string) {
      if (!stores.has(key)) stores.set(key, new Map());
      const store = stores.get(key)!;
      return {
        async put(path: string, value: Response) { store.set(path, value); },
        async match(path: string) { return store.get(path)?.clone(); },
        async addAll(paths: string[]) {
          if (options.quota) throw new DOMException('Storage full', 'QuotaExceededError');
          for (const path of paths) store.set(path, new Response(path));
        },
      };
    },
  };
  const context = {
    URL, location: { origin }, caches,
    fetch: async () => new Response(options.mismatchedShell ? 'wrong deployment' : shell),
    self: {
      addEventListener(name: string, handler: (event: WorkerEvent) => void) { handlers.set(name, handler); },
      async skipWaiting() { skipped = true; },
      clients: { async claim() { claimed = true; } },
    },
  };
  const script = template.replace(/const BUILD = \/\* @arena-manifest \*\/ .*;/, 'const BUILD = { revision: "new", assets: ["/", "/assets/editor-new.js"] };');
  runInNewContext(script, context);
  const lifecycle = async (name: string, data?: { type: string }) => {
    let work: Promise<unknown> | undefined;
    handlers.get(name)!({ data, waitUntil(promise) { work = promise; } });
    await work;
  };
  const navigate = (path: string, mode = 'navigate') => {
    let result: Promise<Response> | undefined;
    handlers.get('fetch')!({ request: { url: origin + path, method: 'GET', mode }, respondWith(promise) { result = promise; } });
    return result;
  };
  return { stores, lifecycle, navigate, context, get skipped() { return skipped; }, get claimed() { return claimed; } };
}

describe('versioned app worker', () => {
  it('preloads the matching shell and local tools, never OAuth/API documents', async () => {
    const subject = worker();
    await subject.lifecycle('install');
    expect([...subject.stores.get('arena-build-new')!.keys()]).toEqual(['/', '/assets/editor-new.js']);
    expect(subject.navigate('/oauth.html?token=synthetic')).toBeUndefined();
    expect(subject.navigate('/api/action')).toBeUndefined();
    subject.context.fetch = async () => { throw new Error('offline'); };
    expect(await (await subject.navigate('/teambuilder'))!.text()).toContain('APP SHELL');
    expect(await (await subject.navigate('/assets/editor-new.js', 'cors'))!.text()).toBe('/assets/editor-new.js');
    expect(subject.skipped).toBe(false);
    await subject.lifecycle('message', { type: 'ARENA_APPLY_UPDATE' });
    expect(subject.skipped).toBe(true);
  });

  it('keeps only current and previous releases, preserving unrelated caches', async () => {
    const subject = worker();
    for (const name of ['unrelated', 'arena-assets-v1', 'arena-shell-v1', 'arena-build-oldest', 'arena-build-previous']) subject.stores.set(name, new Map());
    subject.stores.get('arena-build-previous')!.set('/assets/editor-old.js', new Response('previous editor'));
    await subject.lifecycle('install');
    await subject.lifecycle('activate');
    expect([...subject.stores.keys()]).toEqual(['unrelated', 'arena-build-previous', 'arena-build-new']);
    expect(subject.claimed).toBe(true);
    expect(await (await subject.navigate('/assets/editor-old.js', 'cors'))!.text()).toBe('previous editor');
  });

  it.each([{ quota: true }, { mismatchedShell: true }])('failed install leaves the earlier offline version intact (%j)', async options => {
    const subject = worker(options);
    subject.stores.set('arena-build-previous', new Map([['/', new Response('working old shell')]]));
    await expect(subject.lifecycle('install')).rejects.toThrow();
    expect(subject.stores.has('arena-build-new')).toBe(false);
    expect(subject.stores.has('arena-build-previous')).toBe(true);
  });
});
