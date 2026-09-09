import { clsx } from 'clsx';
import type { BattleChoice, PokemonSet } from '../compat/battle-adapter';
import { pokemonIconStyle } from '../data/sprites';
import { STATUS_LABELS } from '../data/types';
import { PokemonTooltip, TooltipTrigger } from './battle-tooltip';

export function TeamBench({
  team,
  onSwitch,
  format,
  preview = false,
  selection = [],
  allowedSlots,
  onOrderChange,
}: {
  team: PokemonSet[];
  onSwitch?: (pokemon: PokemonSet) => void;
  format?: string;
  preview?: boolean;
  selection?: number[];
  allowedSlots?: number[];
  onOrderChange?: (order: number[]) => void;
}) {
  return (
    <div className="team-bench-wrap">
      <div className="team-bench" role="group" aria-label={preview ? 'Team preview selection' : 'Team bench'}>
        {team.map(pokemon => {
          const fainted = pokemon.fainted || pokemon.hp <= 0;
          const status = pokemon.status ? STATUS_LABELS[pokemon.status] : null;
          const percent = Math.max(0, Math.min(100, pokemon.hp));
          return (
            <TooltipTrigger
              key={pokemon.slot}
              label={pokemon.name}
              content={() => <PokemonTooltip pokemon={pokemon} format={format} />}
            >
              <button
                type="button"
                key={pokemon.slot}
                className={clsx('bench-slot', pokemon.active && 'is-active', fainted && 'is-fainted')}
                disabled={
                  !onSwitch ||
                  (allowedSlots
                    ? !allowedSlots.includes(pokemon.slot)
                    : !preview && (pokemon.active || fainted))
                }
                aria-pressed={preview ? selection.includes(pokemon.slot) : undefined}
                onClick={() => onSwitch?.(pokemon)}
                aria-label={[
                  pokemon.name,
                  fainted
                    ? 'fainted'
                    : pokemon.hpKnown === false
                      ? 'HP unknown'
                      : `${Math.round(percent)}% HP`,
                  preview && selection.includes(pokemon.slot)
                    ? `selected ${selection.indexOf(pokemon.slot) + 1}`
                    : !preview && pokemon.active
                      ? 'currently active'
                      : '',
                  status ? status.label : '',
                ]
                  .filter(Boolean)
                  .join(', ')}
              >
                {/* Icons come from one sprite sheet, so a full roster is one request. */}
                <span className="bench-icon" style={pokemonIconStyle(pokemon.species, fainted)} aria-hidden />
                <span className="bench-body">
                  <strong>
                    {preview && selection.includes(pokemon.slot)
                      ? `${selection.indexOf(pokemon.slot) + 1}. `
                      : ''}
                    {pokemon.name}
                  </strong>
                  <span className="bench-hp" aria-hidden>
                    <i
                      style={{ inlineSize: `${fainted ? 0 : Math.max(percent, 2)}%` }}
                      data-tone={percent > 50 ? 'high' : percent > 20 ? 'mid' : 'low'}
                    />
                  </span>
                </span>
                {status && (
                  <em
                    className="bench-status"
                    style={{ '--status-color': status.color } as React.CSSProperties}
                  >
                    {pokemon.status}
                  </em>
                )}
              </button>
            </TooltipTrigger>
          );
        })}
      </div>
      {preview && selection.length > 0 && (
        <ol className="preview-order" aria-label="Selected team order">
          {selection.map((slot, index) => (
            <li key={slot}>
              <span>
                {index + 1}. {team.find(pokemon => pokemon.slot === slot)?.name}
              </span>
              <button
                type="button"
                aria-label={`Move selection ${index + 1} earlier`}
                disabled={!onOrderChange || index === 0}
                onClick={() => {
                  const order = [...selection];
                  [order[index - 1], order[index]] = [order[index], order[index - 1]];
                  onOrderChange?.(order);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move selection ${index + 1} later`}
                disabled={!onOrderChange || index === selection.length - 1}
                onClick={() => {
                  const order = [...selection];
                  [order[index + 1], order[index]] = [order[index], order[index + 1]];
                  onOrderChange?.(order);
                }}
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export type ChoiceHandler = (choice: BattleChoice | PokemonSet) => void;
