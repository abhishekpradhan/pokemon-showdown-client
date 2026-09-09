import { genFromFormat } from '../data/dex';
import type { StatTable, TeamSet } from '../compat/team-store';
import { BattleStatGuesser } from './stat-guesser';

export type SpreadSuggestion =
  { available: true; role: string; evs: StatTable; nature?: string } | { available: false; reason: string };
export const GUESSER_SOURCE =
  'https://github.com/smogon/pokemon-showdown-client/blob/ac7d535b/play.pokemonshowdown.com/src/battle-tooltips.ts#L3006';

export async function suggestSpread(set: TeamSet, format: string): Promise<SpreadSuggestion> {
  const generation = genFromFormat(format);
  if (!Number.isInteger(generation) || generation < 1 || generation > 9 || /letsgo|champions/.test(format)) {
    return {
      available: false,
      reason: 'This format uses a stat system outside the EV suggestion model. Edit its stats manually.',
    };
  }
  const { Dex } = await import('@pkmn/dex');
  const dex = Dex.forGen(generation as 1);
  const species = dex.species.get(set.species);
  if (!species.exists || species.gen > generation)
    return { available: false, reason: 'Choose a known Pokémon from this generation to suggest a spread.' };
  if (set.moves.some(name => name && (!dex.moves.get(name).exists || dex.moves.get(name).gen > generation))) {
    return {
      available: false,
      reason: 'A move is unknown in this generation. Keep custom spreads or choose known moves.',
    };
  }
  // The upstream heuristic compares several item/ability display names.
  const normalized = {
    ...set,
    item: dex.items.get(set.item || '').name,
    ability: dex.abilities.get(set.ability || '').name,
    level:
      set.level ?? (/vgc|bss|battlestadium|doublesflat/.test(format) ? 50 : /lc$/.test(format) ? 5 : 100),
  };
  const guess = new BattleStatGuesser(format, dex).guess(normalized);
  if (guess.role === '?')
    return {
      available: false,
      reason: 'Choose four moves to infer a role and spread. Ditto and other special sets can use fewer.',
    };
  const nature =
    generation >= 3 && guess.plusStat && guess.minusStat
      ? dex.natures.all().find(entry => entry.plus === guess.plusStat && entry.minus === guess.minusStat)
          ?.name
      : undefined;
  return { available: true, role: guess.role, evs: guess.evs, nature };
}

export function applySpreadSuggestion(
  current: TeamSet,
  suggestion: Extract<SpreadSuggestion, { available: true }>,
): TeamSet {
  return {
    ...current,
    evs: { ...suggestion.evs },
    ...(suggestion.nature ? { nature: suggestion.nature } : {}),
  };
}

export function describeSpread(evs: StatTable, generation = 9) {
  const labels = {
    hp: 'HP',
    atk: 'Atk',
    def: 'Def',
    spa: generation === 1 ? 'Spc' : 'SpA',
    spd: 'SpD',
    spe: 'Spe',
  };
  return (
    (Object.keys(labels) as Array<keyof StatTable>)
      .filter(stat => evs[stat])
      .map(stat => `${evs[stat]} ${labels[stat]}`)
      .join(' / ') || 'No EV investment'
  );
}
