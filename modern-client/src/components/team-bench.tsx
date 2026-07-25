import { clsx } from 'clsx';
import type { BattleChoice, PokemonSet } from '../compat/battle-adapter';
import { pokemonIconStyle } from '../data/sprites';
import { STATUS_LABELS } from '../data/types';

export function TeamBench({ team, onSwitch }: {
  team: PokemonSet[];
  onSwitch?: (pokemon: PokemonSet) => void;
}) {
  return (
    <div className="team-bench" aria-label="Team bench">
      {team.map(pokemon => {
        const fainted = pokemon.fainted || pokemon.hp <= 0;
        const status = pokemon.status ? STATUS_LABELS[pokemon.status] : null;
        const percent = Math.max(0, Math.min(100, pokemon.hp));
        return (
          <button
            type="button"
            key={pokemon.slot}
            className={clsx('bench-slot', pokemon.active && 'is-active', fainted && 'is-fainted')}
            disabled={!onSwitch || pokemon.active || fainted}
            onClick={() => onSwitch?.(pokemon)}
            aria-label={[
              pokemon.name,
              fainted ? 'fainted' : `${Math.round(percent)}% HP`,
              pokemon.active ? 'currently active' : '',
              status ? status.label : '',
            ].filter(Boolean).join(', ')}
          >
            {/* Icons come from one sprite sheet, so a full roster is one request. */}
            <span className="bench-icon" style={pokemonIconStyle(pokemon.species, fainted)} aria-hidden />
            <span className="bench-body">
              <strong>{pokemon.name}</strong>
              <span className="bench-hp" aria-hidden>
                <i
                  style={{ inlineSize: `${fainted ? 0 : Math.max(percent, 2)}%` }}
                  data-tone={percent > 50 ? 'high' : percent > 20 ? 'mid' : 'low'}
                />
              </span>
            </span>
            {status && (
              <em className="bench-status" style={{ '--status-color': status.color } as React.CSSProperties}>
                {pokemon.status}
              </em>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type ChoiceHandler = (choice: BattleChoice | PokemonSet) => void;
