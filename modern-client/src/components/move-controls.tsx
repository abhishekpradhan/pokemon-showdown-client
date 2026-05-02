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
          {(move.canTerastallize || move.canMegaEvo || move.canZMove || move.canDynamax || move.canUltraBurst) && (
            <span className="move-flags" aria-label={`${move.name} battle modifiers`}>
              {move.canTerastallize && <i onClick={event => { event.stopPropagation(); onChoose(withFlag(move, 'terastallize')); }}>Tera</i>}
              {move.canMegaEvo && <i onClick={event => { event.stopPropagation(); onChoose(withFlag(move, 'mega')); }}>Mega</i>}
              {move.canZMove && <i onClick={event => { event.stopPropagation(); onChoose(withFlag(move, 'zmove')); }}>Z</i>}
              {move.canDynamax && <i onClick={event => { event.stopPropagation(); onChoose(withFlag(move, 'dynamax')); }}>Max</i>}
              {move.canUltraBurst && <i onClick={event => { event.stopPropagation(); onChoose(withFlag(move, 'ultra')); }}>Ultra</i>}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
