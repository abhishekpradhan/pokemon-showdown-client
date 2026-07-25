/**
 * Sprite and icon URLs.
 *
 * Species names map to sprite filenames through rules the client should not be
 * guessing at: cosmetic formes, regional formes, gendered sprites and back
 * sprites all have their own conventions. `@pkmn/img` owns those rules, which
 * is why `Pikachu-Original` resolves instead of 404ing.
 */

import { Icons, Sprites } from '@pkmn/img';
import type { GenerationNum } from '@pkmn/types';
import { DEFAULT_GEN } from './dex';

/** Where sprite and icon assets are served from. */
export const SPRITE_HOST =
  import.meta.env.VITE_PS_SPRITE_HOST || 'https://play.pokemonshowdown.com';

export type SpriteOptions = {
  /** `near` renders the player's back sprite, `far` the opponent's front. */
  side: 'near' | 'far';
  gen?: number;
  shiny?: boolean;
  gender?: 'M' | 'F';
  fainted?: boolean;
  /** Prefer static art over animated sprites (used by reduced-motion). */
  still?: boolean;
};

export type ResolvedSprite = {
  url: string;
  width: number;
  height: number;
  /** Pixel offset applied by PS to seat a sprite on the battle platform. */
  pixelated: boolean;
};

export function pokemonSprite(species: string, options: SpriteOptions): ResolvedSprite {
  const sprite = Sprites.getPokemon(species || 'substitute', {
    gen: (options.still ? 5 : (options.gen ?? DEFAULT_GEN)) as GenerationNum,
    side: options.side === 'near' ? 'p1' : 'p2',
    shiny: options.shiny,
    gender: options.gender,
    protocol: 'https',
    domain: SPRITE_HOST.replace(/^https?:\/\//, ''),
  });
  return {
    url: sprite.url,
    width: sprite.w,
    height: sprite.h,
    pixelated: !!sprite.pixelated,
  };
}

/**
 * Inline styles for a team-list icon. These come from a single sprite sheet, so
 * a full roster costs one request rather than six.
 */
export function pokemonIconStyle(species: string, fainted = false) {
  const icon = Icons.getPokemon(species || 'substitute', {
    protocol: 'https',
    domain: SPRITE_HOST.replace(/^https?:\/\//, ''),
    fainted,
  });
  return {
    display: 'inline-block',
    width: '40px',
    height: '30px',
    imageRendering: 'pixelated' as const,
    background: icon.css.background,
    opacity: fainted ? 0.4 : undefined,
  };
}

/** Item icon (held-item chips in the team panel). */
export function itemIconStyle(item: string) {
  const icon = Icons.getItem(item, {
    protocol: 'https',
    domain: SPRITE_HOST.replace(/^https?:\/\//, ''),
  });
  return {
    display: 'inline-block',
    width: '24px',
    height: '24px',
    imageRendering: 'pixelated' as const,
    background: icon.css.background,
  };
}
