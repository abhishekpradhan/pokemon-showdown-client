/**
 * Canonical Pokémon type presentation.
 *
 * Type colour is how players read a move deck at a glance, so every type gets
 * its own identity rather than being folded into a handful of shared classes.
 * Values are the long-established Pokémon Showdown type colours.
 */

import type { TypeName } from '@pkmn/types';

export type { TypeName };

export const TYPE_COLORS: Record<TypeName, string> = {
  Normal: '#9099a1',
  Fire: '#ff9d55',
  Water: '#4d90d5',
  Electric: '#f4d23c',
  Grass: '#63bc5a',
  Ice: '#73cec0',
  Fighting: '#bd3158',
  Poison: '#ab6ac8',
  Ground: '#d97845',
  Flying: '#8fa8dd',
  Psychic: '#f97176',
  Bug: '#90c12c',
  Rock: '#c7b78b',
  Ghost: '#4b60a0',
  Dragon: '#0a63b2',
  Dark: '#5a5465',
  Steel: '#5a8ea1',
  Fairy: '#ec8fe6',
  Stellar: '#3fa2a7',
  '???': '#68a090',
};

/** Text colour that meets contrast on the matching background above. */
export const TYPE_INK: Record<TypeName, string> = {
  Normal: '#12161a', Fire: '#2b1405', Water: '#06131f', Electric: '#2e2503',
  Grass: '#08240a', Ice: '#062521', Fighting: '#fff2f6', Poison: '#1d0429',
  Ground: '#2a1004', Flying: '#0d1830', Psychic: '#320c0e', Bug: '#132000',
  Rock: '#241d0c', Ghost: '#eef1ff', Dragon: '#e9f3ff', Dark: '#f2f0f6',
  Steel: '#04191d', Fairy: '#3a0a35', Stellar: '#04211f', '???': '#04211f',
};

export const ALL_TYPES = Object.keys(TYPE_COLORS) as TypeName[];

export function typeColor(type: TypeName | string | undefined) {
  return TYPE_COLORS[(type || '???') as TypeName] ?? TYPE_COLORS['???'];
}

export function typeInk(type: TypeName | string | undefined) {
  return TYPE_INK[(type || '???') as TypeName] ?? TYPE_INK['???'];
}

/** CSS custom properties for a type-tinted surface. */
export function typeStyle(type: TypeName | string | undefined) {
  return {
    '--type-color': typeColor(type),
    '--type-ink': typeInk(type),
  } as React.CSSProperties;
}

/** How an effectiveness multiplier should be emphasised. */
export function effectivenessTone(label?: string): 'immune' | 'resisted' | 'neutral' | 'super' {
  if (!label) return 'neutral';
  if (label === '0x') return 'immune';
  if (label === '¼x' || label === '½x') return 'resisted';
  if (label === '1x') return 'neutral';
  return 'super';
}

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  BRN: { label: 'Burn', color: '#ee6969' },
  PAR: { label: 'Paralysis', color: '#e8d165' },
  PSN: { label: 'Poison', color: '#c07fd6' },
  TOX: { label: 'Bad poison', color: '#a855c9' },
  SLP: { label: 'Sleep', color: '#9aa4b0' },
  FRZ: { label: 'Freeze', color: '#78d4e8' },
};
