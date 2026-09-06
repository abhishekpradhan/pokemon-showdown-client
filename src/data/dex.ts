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
let unrestrictedGenerations: Generations | null = null;
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
    unrestrictedGenerations = new Generations(Dex, entry => !!entry.exists && (!('isNonstandard' in entry) || entry.isNonstandard !== 'Future'));
    listeners.forEach(listener => listener());
    return generations;
  })().catch(error => { loading = null; throw error; });
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

/** Keep generation-specific formulas in the dex implementation, including old-generation DVs. */
export function calculateSetStats(set: import('../compat/team-store').TeamSet, generationNumber: number, defaultLevel = 100) {
  const generation = gen(generationNumber);
  const species = generation?.species.get(set.species);
  if (!generation || !species) return null;
  return Object.fromEntries((['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).map(stat => [stat,
    generation.stats.calc(stat, species.baseStats[stat], set.ivs?.[stat] ?? 31, set.evs?.[stat] ?? (generationNumber <= 2 ? 252 : 0), set.level ?? defaultLevel, set.nature ? generation.natures.get(set.nature) : undefined),
  ])) as Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>;
}

/** National Dex/CAP/custom formats keep past and mod data selectable; server validation owns clauses. */
export function genForFormat(formatId: string, showAll = false): Generation | null {
  const number = Math.min(9, Math.max(1, genFromFormat(formatId))) as 1;
  return showAll || /nationaldex|cap|hackmons|customgame/.test(formatId) ? unrestrictedGenerations?.get(number) || null : gen(number);
}

export function defaultAbilityForSpecies(name: string, formatId: string) {
  return genForFormat(formatId, true)?.species.get(name)?.abilities['0'];
}
