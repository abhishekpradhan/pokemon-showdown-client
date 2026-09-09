// @vitest-environment node
import {
  applySampleSet,
  fetchSampleSets,
  MAX_SAMPLE_BYTES,
  parseSampleCatalog,
  sampleSetUrl,
  SAMPLE_TIMEOUT_MS,
} from './sample-sets';

const dataset = JSON.stringify({
  dex: {
    Clefable: {
      'Calm Mind': {
        moves: ['Calm Mind', 'Moonblast', 'Moonlight', 'Knock Off'],
        ability: 'Magic Guard',
        item: 'Leftovers',
        nature: 'Bold',
        ivs: { atk: 0 },
        evs: { hp: 252, def: 252, spd: 4 },
        teraType: 'Water',
      },
    },
  },
  stats: { Clefable: { 'Showdown Usage': { moves: ['Moonblast'], evs: { hp: 0 }, happiness: 0 } } },
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('keeps analysis and usage provenance and zero-valued details', () => {
  const entries = parseSampleCatalog(dataset).get('clefable')!;
  expect(entries.map(entry => entry.source)).toEqual(['analysis', 'usage']);
  expect(entries[0].set.ivs).toEqual({ atk: 0 });
  expect(entries[1].set).toMatchObject({ evs: { hp: 0 }, happiness: 0 });
  expect(
    applySampleSet(
      {
        species: 'clefable',
        name: 'My partner',
        moves: ['Tackle'],
        gender: 'F',
        shiny: true,
        happiness: 0,
        pokeball: 'Cherish Ball',
        hpType: 'Ice',
      },
      entries[0],
    ),
  ).toMatchObject({
    species: 'clefable',
    name: 'My partner',
    moves: ['Calm Mind', 'Moonblast', 'Moonlight', 'Knock Off'],
    gender: 'F',
    shiny: true,
    happiness: 0,
    pokeball: 'Cherish Ball',
    hpType: 'Ice',
    ivs: { atk: 0 },
    nature: 'Bold',
  });
  expect(() => applySampleSet({ species: 'Pikachu', moves: [] }, entries[0])).toThrow('current Pokémon');
});

it('rejects unsafe paths and malformed sample fields without importing arbitrary keys', () => {
  for (const format of ['gen9', '../gen9ou', 'gen9ou?x=1', 'gen10ou', 'https://other.test'])
    expect(() => sampleSetUrl(format)).toThrow();
  const catalog = parseSampleCatalog(
    '{"dex":{"Clefable":{"bad":{"moves":["Moonblast\\n/forfeit"]},"bad ev":{"moves":["Moonblast"],"evs":{"hp":999}},"safe":{"moves":["Moonblast"],"__proto__":{"polluted":true},"name":"overwrite"}}}}',
  );
  expect(catalog.get('clefable')).toHaveLength(1);
  expect(catalog.get('clefable')![0].set).toEqual({ species: 'Clefable', moves: ['Moonblast'] });
  expect(() => parseSampleCatalog('<html>Error</html>')).toThrow('invalid JSON');
  expect(() => parseSampleCatalog('[]')).toThrow('unexpected dataset');
});

it('uses the official endpoint without credentials and caches immutable parsed samples', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(dataset));
  vi.stubGlobal('fetch', fetcher);
  const first = await fetchSampleSets('gen9ou', 'Clefable', new AbortController().signal);
  first[0].set.moves[0] = 'Tackle';
  const second = await fetchSampleSets('gen9ou', 'clefable', new AbortController().signal);
  expect(second[0].set.moves[0]).toBe('Calm Mind');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(
    'https://play.pokemonshowdown.com/data/sets/gen9ou.json',
    expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' }),
  );
});

it('distinguishes unpublished formats from failures that can retry', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('', { status: 404 }))
    .mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(new Response(dataset));
  vi.stubGlobal('fetch', fetcher);
  expect(await fetchSampleSets('gen9customgame', 'Clefable', new AbortController().signal)).toEqual([]);
  await expect(fetchSampleSets('gen9uu', 'Clefable', new AbortController().signal)).rejects.toThrow('503');
  expect(await fetchSampleSets('gen9uu', 'Clefable', new AbortController().signal)).toHaveLength(2);
});

it('enforces streamed byte limits without waiting for a stuck cancel operation', async () => {
  const cancel = vi.fn(() => new Promise<void>(() => {}));
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(MAX_SAMPLE_BYTES + 1));
          },
          cancel,
        }),
      ),
    ),
  );
  await expect(fetchSampleSets('gen9ru', 'Clefable', new AbortController().signal)).rejects.toThrow('2 MB');
  expect(cancel).toHaveBeenCalled();
});

it('bounds stalled fetches and body reads, and cancels explicitly dismissed loads', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => new Promise(() => {})),
  );
  const pending = expect(fetchSampleSets('gen9nu', 'Clefable', new AbortController().signal)).rejects.toThrow(
    'timed out',
  );
  await vi.advanceTimersByTimeAsync(SAMPLE_TIMEOUT_MS);
  await pending;
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(new Response(new ReadableStream({ cancel: () => new Promise<void>(() => {}) }))),
  );
  const body = expect(fetchSampleSets('gen9pu', 'Clefable', new AbortController().signal)).rejects.toThrow(
    'timed out',
  );
  await vi.advanceTimersByTimeAsync(SAMPLE_TIMEOUT_MS);
  await body;
  const controller = new AbortController();
  const dismissed = expect(fetchSampleSets('gen9lc', 'Clefable', controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  controller.abort();
  await dismissed;
});
