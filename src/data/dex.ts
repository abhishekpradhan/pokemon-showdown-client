/**
 * Pokédex access.
 *
 * The dataset is large (the full dex across nine generations), so it is loaded
 * as its own chunk rather than bundled into the app shell. `loadDex()` is fired
 * once at boot; UI that needs species or move facts reads through the sync
 * accessors, which degrade to `undefined` until the chunk lands.
 */

import type { Generation, Generations } from '@pkmn/data';
import type { StatusName, TypeName } from '@pkmn/types';

export type { TypeName, StatusName };

/** Current generation used when the server has not told us the format's gen. */
export const DEFAULT_GEN = 9;

let generations: Generations | null = null;
let loading: Promise<Generations> | null = null;
const listeners = new Set<() => void>();

/** Loads the dex chunk. Safe to call repeatedly; the work happens once. */
export function loadDex(): Promise<Generations> {
  if (generations) return Promise.resolve(generations);
  loading ??= (async () => {
    const [{ Dex }, { Generations }] = await Promise.all([
      import('@pkmn/dex'),
      import('@pkmn/data'),
    ]);
    generations = new Generations(Dex);
    listeners.forEach(listener => listener());
    return generations;
  })();
  return loading;
}

/** Subscribe to dex readiness (used by `useDexReady`). */
export function onDexLoaded(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isDexLoaded() {
  return generations !== null;
}

/** Synchronous generation handle, or `null` before the chunk resolves. */
export function gen(num: number = DEFAULT_GEN): Generation | null {
  if (!generations) return null;
  const clamped = Math.min(Math.max(Math.trunc(num) || DEFAULT_GEN, 1), DEFAULT_GEN);
  return generations.get(clamped as 1);
}

/** Extracts the generation number from a format id such as `gen9ou`. */
export function genFromFormat(formatId?: string) {
  const match = /^gen(\d+)/.exec(formatId || '');
  return match ? Number(match[1]) : DEFAULT_GEN;
}

export function getMove(name: string, generation = DEFAULT_GEN) {
  return gen(generation)?.moves.get(name) ?? null;
}

export function getSpecies(name: string, generation = DEFAULT_GEN) {
  return gen(generation)?.species.get(name) ?? null;
}

export function getItem(name: string, generation = DEFAULT_GEN) {
  return gen(generation)?.items.get(name) ?? null;
}

export function getAbility(name: string, generation = DEFAULT_GEN) {
  return gen(generation)?.abilities.get(name) ?? null;
}

/**
 * Damage multiplier of an attacking type against a defending typing.
 * Returns `null` when the dex has not loaded, so callers can hide the hint
 * rather than render a wrong one.
 */
export function effectiveness(
  attacking: TypeName,
  defending: readonly TypeName[],
  generation = DEFAULT_GEN
): number | null {
  const generationData = gen(generation);
  if (!generationData || !defending.length) return null;
  const type = generationData.types.get(attacking);
  if (!type) return null;
  return defending.reduce((total, defType) => total * (type.effectiveness[defType] ?? 1), 1);
}

/** Formats a multiplier the way players read it: `4x`, `½x`, `0x`. */
export function formatEffectiveness(multiplier: number | null) {
  if (multiplier === null) return null;
  if (multiplier === 0) return '0x';
  if (multiplier === 0.25) return '¼x';
  if (multiplier === 0.5) return '½x';
  return `${multiplier}x`;
}
