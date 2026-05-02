import { clsx } from 'clsx';
import type { BattleChoice, PokemonSet } from '../compat/battle-adapter';

export function TeamBench({ team, onSwitch }: {
  team: PokemonSet[];
  onSwitch?: (pokemon: PokemonSet) => void;
}) {
  return (
    <div className="team-bench" aria-label="Team bench">
      {team.map(pokemon => (
        <button
          type="button"
          key={pokemon.slot}
          className={clsx('bench-slot', pokemon.active && 'is-active', pokemon.fainted && 'is-fainted')}
          disabled={!onSwitch || pokemon.active || pokemon.fainted}
          onClick={() => onSwitch?.(pokemon)}
          aria-label={`${pokemon.name} ${pokemon.hp}%`}
        >
          <span className="bench-icon" aria-hidden>
            <img
              src={`https://play.pokemonshowdown.com/sprites/gen5/${pokemon.species}.png`}
              alt=""
              onError={event => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </span>
          <strong>{pokemon.name}</strong>
          <span className="bench-hp">
            <i style={{ inlineSize: `${Math.max(pokemon.hp, 1)}%` }} />
          </span>
          {pokemon.status && <em>{pokemon.status}</em>}
        </button>
      ))}
    </div>
  );
}

export type ChoiceHandler = (choice: BattleChoice | PokemonSet) => void;
