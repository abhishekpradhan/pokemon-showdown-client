import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export async function runSessionStress() {
  const directory = mkdtempSync(join(tmpdir(), 'arena-session-stress-'));
  const file = join(directory, 'stress.mjs');
  await build({ stdin: { resolveDir: resolve('.'), contents: `
    import assert from 'node:assert/strict';
    const events = new EventTarget();
    globalThis.window = globalThis;
    globalThis.addEventListener = events.addEventListener.bind(events);
    globalThis.removeEventListener = events.removeEventListener.bind(events);
    globalThis.document = {hidden: false};
    const storage = () => { const data = new Map(); return {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), clear: () => data.clear()}; };
    Object.defineProperty(globalThis, 'localStorage', {value: storage(), configurable: true});
    globalThis.sessionStorage = storage();
    const {exerciseLongSession} = await import('./src/test/long-session-scenario.ts');
    const heap = () => { globalThis.gc(); return process.memoryUsage().heapUsed; };
    exerciseLongSession();
    const baseline = heap();
    const samples = Array.from({length: 3}, () => exerciseLongSession(heap));
    for (const sample of samples) {
      assert(sample.closedRooms <= 12 && sample.openRooms === 3);
      assert(sample.maxChatEntries <= 2000 && sample.maxRoomLogEntries <= 400);
      assert(sample.rawProtocolEntries === 240 && sample.userCards === 200);
      assert(sample.successfulRoomErrorEntries === 0 && sample.emptyRoomErrorEntries === 0);
      assert(sample.retainedFailureEntries === 32 && sample.roomErrorEntries === 31);
      assert(sample.oldestFailureDiscarded && sample.latestFailureRetained && sample.recoveredFailureCleared);
      assert(sample.snapshotEntries === 1 && sample.activeRoomRetained);
      assert(sample.batchP95Ms < 2500, '500-message batch exceeded the regression budget.');
      assert(sample.heapUsedBytes - baseline < 48 * 1024 * 1024, 'Retained session state exceeded the heap budget.');
    }
    const growth = samples.at(-1).heapUsedBytes - samples[0].heapUsedBytes;
    assert(growth < 16 * 1024 * 1024, 'Repeated sessions show unbounded retained heap growth.');
    console.log(JSON.stringify({node: process.version, methodology: 'One warmup, three identical 13k-frame sessions; forced GC while retained application state is alive; isolated 256MiB V8 heap', baselineHeapBytes: baseline, repeatGrowthBytes: growth, budgets: {retainedHeapBytes: 48*1024*1024, repeatGrowthBytes: 16*1024*1024, p95BatchMs: 2500}, samples}));
  ` }, bundle: true, platform: 'node', format: 'esm', outfile: file, define: { 'import.meta.env': JSON.stringify({ MODE: 'integration', DEV: false }) } });
  const output = execFileSync(process.execPath, ['--expose-gc', '--max-old-space-size=256', file], { encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
  const report = JSON.parse(output.trim().split('\n').at(-1));
  assert.equal(report.samples.length, 3);
  writeFileSync(resolve('test-results-session-stress.json'), JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await runSessionStress(), null, 2));
