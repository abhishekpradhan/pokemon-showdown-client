import { toId } from '../compat/protocol-parsers';
import type { StatTable, TeamSet } from '../compat/team-store';

/** Same public, per-format dataset consumed by upstream client-teambuilder.js. */
export const SAMPLE_SET_ORIGIN = 'https://play.pokemonshowdown.com';
export const MAX_SAMPLE_BYTES = 2 * 1024 * 1024;
export const SAMPLE_TIMEOUT_MS = 10_000;
export type SampleSet = { id: string; name: string; source: 'analysis' | 'usage'; set: TeamSet };
type Catalog = Map<string, SampleSet[]>;
const cache = new Map<string, { catalog: Catalog; expires: number }>();
const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const plainText = (value: unknown, max = 100): value is string =>
  typeof value === 'string' &&
  !!value.trim() &&
  value.length <= max &&
  ![...value].some(
    character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 || character === '|',
  );

export function sampleSetUrl(format: string) {
  if (!/^gen[1-9](?:[a-z][a-z0-9]{0,69}|1v1|2v2doubles)$/.test(format))
    throw new Error('Choose a specific generation and format to browse sample sets.');
  return `${SAMPLE_SET_ORIGIN}/data/sets/${format}.json`;
}

function readStats(value: unknown, maximum: number): StatTable | null {
  if (!record(value)) return null;
  const result: StatTable = {};
  for (const [key, amount] of Object.entries(value)) {
    if (
      !stats.includes(key as (typeof stats)[number]) ||
      !Number.isInteger(amount) ||
      Number(amount) < 0 ||
      Number(amount) > maximum
    )
      return null;
    result[key as keyof StatTable] = Number(amount);
  }
  return result;
}

function readSet(value: unknown, species: string): TeamSet | null {
  if (
    !record(value) ||
    !Array.isArray(value.moves) ||
    !value.moves.length ||
    value.moves.length > 4 ||
    !value.moves.every(move => plainText(move))
  )
    return null;
  const set: TeamSet = { species, moves: [...value.moves] as string[] };
  for (const key of ['item', 'ability', 'nature', 'teraType', 'hpType', 'pokeball', 'gender'] as const) {
    if (value[key] === undefined) continue;
    if (!plainText(value[key])) return null;
    set[key] = value[key];
  }
  for (const [key, maximum] of [
    ['evs', 252],
    ['ivs', 31],
  ] as const) {
    if (value[key] === undefined) continue;
    const parsed = readStats(value[key], maximum);
    if (!parsed) return null;
    set[key] = parsed;
  }
  for (const [key, minimum, maximum] of [
    ['level', 1, 100],
    ['happiness', 0, 255],
    ['dynamaxLevel', 0, 10],
  ] as const) {
    if (value[key] === undefined) continue;
    if (!Number.isInteger(value[key]) || Number(value[key]) < minimum || Number(value[key]) > maximum)
      return null;
    set[key] = Number(value[key]);
  }
  for (const key of ['shiny', 'gigantamax'] as const) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== 'boolean') return null;
    set[key] = value[key];
  }
  return set;
}

/** Unknown/malformed entries never become executable markup or imported fields. */
export function parseSampleCatalog(text: string): Catalog {
  if (new TextEncoder().encode(text).byteLength > MAX_SAMPLE_BYTES)
    throw new Error('Sample-set data exceeds the 2 MB limit.');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The sample service returned invalid JSON.');
  }
  if (!record(data) || (!record(data.dex) && !record(data.stats)))
    throw new Error('The sample service returned an unexpected dataset.');
  const catalog: Catalog = new Map();
  let count = 0;
  for (const [section, source] of [
    ['dex', 'analysis'],
    ['stats', 'usage'],
  ] as const) {
    if (!record(data[section])) continue;
    for (const [species, sets] of Object.entries(data[section])) {
      if (!plainText(species) || !record(sets)) continue;
      for (const [name, raw] of Object.entries(sets)) {
        if (++count > 10_000) throw new Error('The sample service returned too many sets.');
        if (!plainText(name, 160)) continue;
        const set = readSet(raw, species);
        if (!set) continue;
        const id = toId(species);
        const list = catalog.get(id) || [];
        if (list.length < 100) list.push({ id: `${section}:${name}`, name, source, set });
        catalog.set(id, list);
      }
    }
  }
  return catalog;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(signal.reason || new DOMException('Cancelled', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      value => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
    if (signal.aborted) abort();
  });
}

async function readResponse(response: Response, signal: AbortSignal) {
  if (Number(response.headers.get('content-length')) > MAX_SAMPLE_BYTES) {
    void response.body?.cancel().catch(() => {});
    throw new Error('Sample-set data exceeds the 2 MB limit.');
  }
  if (!response.body?.getReader) {
    const text = await abortable(response.text(), signal);
    if (new TextEncoder().encode(text).byteLength > MAX_SAMPLE_BYTES)
      throw new Error('Sample-set data exceeds the 2 MB limit.');
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await abortable(reader.read(), signal);
      if (chunk.done) return text + decoder.decode();
      size += chunk.value.byteLength;
      if (size > MAX_SAMPLE_BYTES) throw new Error('Sample-set data exceeds the 2 MB limit.');
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    // A stuck producer must not extend the deadline during cancellation.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function fetchSampleSets(
  format: string,
  species: string,
  signal: AbortSignal,
): Promise<SampleSet[]> {
  const url = sampleSetUrl(format);
  signal.throwIfAborted();
  const cached = cache.get(format);
  if (cached && cached.expires > Date.now()) return structuredClone(cached.catalog.get(toId(species)) || []);
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error('Sample sets timed out. Check your connection and retry.')),
    SAMPLE_TIMEOUT_MS,
  );
  try {
    const response = await abortable(
      fetch(url, {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'error',
      }),
      controller.signal,
    );
    let catalog: Catalog;
    if (response.status === 404) {
      void response.body?.cancel().catch(() => {});
      catalog = new Map();
    } else {
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new Error(`Sample sets could not load (HTTP ${response.status}).`);
      }
      catalog = parseSampleCatalog(await readResponse(response, controller.signal));
    }
    controller.signal.throwIfAborted();
    cache.delete(format);
    cache.set(format, { catalog, expires: Date.now() + 15 * 60_000 });
    if (cache.size > 6) cache.delete(cache.keys().next().value!);
    return structuredClone(catalog.get(toId(species)) || []);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
  }
}

/** Like upstream, overlay supplied fields while preserving personal details. */
export function applySampleSet(current: TeamSet, sample: SampleSet): TeamSet {
  if (toId(current.species) !== toId(sample.set.species))
    throw new Error('Choose a sample for the current Pokémon.');
  return {
    ...structuredClone(current),
    ...structuredClone(sample.set),
    species: current.species,
    name: current.name,
  };
}
