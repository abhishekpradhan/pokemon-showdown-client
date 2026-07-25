import { clsx } from 'clsx';
import type { BattleChoice } from '../compat/battle-adapter';

const typeClass: Record<BattleChoice['type'], string> = {
  Bug: 'type-grass',
  Dark: 'type-dark',
  Dragon: 'type-dark',
  Electric: 'type-electric',
  Fairy: 'type-fairy',
  Fighting: 'type-fighting',
  Fire: 'type-fire',
  Flying: 'type-water',
  Ghost: 'type-dark',
  Grass: 'type-grass',
  Ground: 'type-ground',
  Ice: 'type-water',
  Normal: 'type-dark',
  Poison: 'type-fairy',
  Psychic: 'type-fairy',
  Rock: 'type-ground',
  Steel: 'type-dark',
  Water: 'type-water',
};

export function MoveControls({ moves, onChoose }: {
  moves: BattleChoice[];
  onChoose: (move: BattleChoice) => void;
}) {
  const withFlag = (move: BattleChoice, flag: string): BattleChoice => ({
    ...move,
    cmd: move.cmd.replace(/(\|\d+)?$/, match => ` ${flag}${match}`),
  });

  return (
    <div className="move-grid" aria-label="Move choices">
      {moves.map(move => (
        <div className={clsx('move-choice', typeClass[move.type], move.disabled && 'is-disabled')} key={`${move.slot}-${move.name}`}>
          <button
            type="button"
            className="move-button"
            disabled={move.disabled}
            aria-label={`${move.name}, ${move.type}, ${move.pp} PP, effectiveness ${move.effectiveness}`}
            onClick={() => onChoose(move)}
          >
            <strong>{move.name}</strong>
            <span>{move.type}</span>
            <em>{move.effectiveness}</em>
            <small>{move.pp}</small>
          </button>
          {(move.canTerastallize || move.canMegaEvo || move.canZMove || move.canDynamax || move.canUltraBurst) && (
            <div className="move-flags" aria-label={`${move.name} battle modifiers`}>
              {move.canTerastallize && <button type="button" onClick={() => onChoose(withFlag(move, 'terastallize'))}>Tera</button>}
              {move.canMegaEvo && <button type="button" onClick={() => onChoose(withFlag(move, 'mega'))}>Mega</button>}
              {move.canZMove && <button type="button" onClick={() => onChoose(withFlag(move, 'zmove'))}>Z</button>}
              {move.canDynamax && <button type="button" onClick={() => onChoose(withFlag(move, 'dynamax'))}>Max</button>}
              {move.canUltraBurst && <button type="button" onClick={() => onChoose(withFlag(move, 'ultra'))}>Ultra</button>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
