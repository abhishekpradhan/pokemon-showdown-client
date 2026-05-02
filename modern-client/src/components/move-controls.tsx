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
  return (
    <div className="move-grid" aria-label="Move choices">
      {moves.map(move => (
        <button
          type="button"
          key={move.name}
          className={clsx('move-button', typeClass[move.type], move.disabled && 'is-disabled')}
          disabled={move.disabled}
          aria-label={`${move.name}, ${move.type}, ${move.pp} PP, effectiveness ${move.effectiveness}`}
          onClick={() => onChoose(move)}
        >
          <strong>{move.name}</strong>
          <span>{move.type}</span>
          <em>{move.effectiveness}</em>
          <small>{move.pp}</small>
        </button>
      ))}
    </div>
  );
}
