import { clsx } from 'clsx';
import { useState } from 'react';
import type { BattleChoice } from '../compat/battle-adapter';
import { effectivenessTone, typeStyle } from '../data/types';

/**
 * Gimmick modifiers (Tera, Mega, Z, Dynamax, Ultra) apply to the turn, not to a
 * single move, so they are one armed toggle above the deck rather than a row of
 * buttons repeated under all four moves.
 */
type Gimmick = { flag: string; label: string; hint: string };

const gimmicksFor = (moves: BattleChoice[]): Gimmick[] => {
  const first = moves[0];
  if (!first) return [];
  return [
    first.canTerastallize && { flag: 'terastallize', label: 'Terastallize', hint: 'Change your type for the rest of the battle' },
    first.canMegaEvo && { flag: 'mega', label: 'Mega Evolve', hint: 'Mega Evolve before attacking' },
    first.canZMove && { flag: 'zmove', label: 'Z-Move', hint: 'Upgrade this move to its Z-Move' },
    first.canDynamax && { flag: 'dynamax', label: 'Dynamax', hint: 'Dynamax before attacking' },
    first.canUltraBurst && { flag: 'ultra', label: 'Ultra Burst', hint: 'Ultra Burst before attacking' },
  ].filter(Boolean) as Gimmick[];
};

function MoveMeta({ move }: { move: BattleChoice }) {
  const parts = [
    move.category,
    move.category !== 'Status' && move.basePower ? `${move.basePower} BP` : null,
    move.accuracy && move.accuracy !== true ? `${move.accuracy}%` : null,
  ].filter(Boolean);
  return parts.length ? <span className="move-meta">{parts.join(' · ')}</span> : null;
}

export function MoveControls({ moves, onChoose }: {
  moves: BattleChoice[];
  onChoose: (move: BattleChoice) => void;
}) {
  const gimmicks = gimmicksFor(moves);
  const [armed, setArmed] = useState<string | null>(null);

  const choose = (move: BattleChoice) => {
    // Splice the flag in before the `|rqid` suffix the server matches on.
    const cmd = armed ? move.cmd.replace(/(\|\d+)?$/, match => ` ${armed}${match}`) : move.cmd;
    onChoose({ ...move, cmd });
    setArmed(null);
  };

  return (
    <div className="move-deck-inner">
      {gimmicks.length > 0 && (
        <div className="gimmick-row" role="group" aria-label="Turn modifiers">
          {gimmicks.map(gimmick => (
            <button
              key={gimmick.flag}
              type="button"
              className={clsx('gimmick-toggle', armed === gimmick.flag && 'is-armed')}
              aria-pressed={armed === gimmick.flag}
              title={gimmick.hint}
              onClick={() => setArmed(current => current === gimmick.flag ? null : gimmick.flag)}
            >
              {gimmick.label}
            </button>
          ))}
          {armed && <span className="gimmick-hint" role="status">Now pick a move.</span>}
        </div>
      )}

      <div className="move-grid" role="group" aria-label="Move choices">
        {moves.map(move => {
          const tone = effectivenessTone(move.effectiveness);
          return (
            <button
              type="button"
              key={`${move.slot}-${move.name}`}
              className={clsx('move-choice', move.disabled && 'is-disabled')}
              style={typeStyle(move.type)}
              disabled={move.disabled}
              data-effect={tone}
              aria-label={[
                move.name,
                move.type,
                move.category,
                move.basePower ? `${move.basePower} base power` : '',
                `${move.pp} PP`,
                move.effectiveness ? `${move.effectiveness} effective` : '',
                move.disabled ? 'disabled' : '',
              ].filter(Boolean).join(', ')}
              onClick={() => choose(move)}
            >
              <span className="move-headline">
                <strong>{move.name}</strong>
                {move.effectiveness && move.effectiveness !== '1x' && (
                  <em className="move-effect" data-effect={tone}>{move.effectiveness}</em>
                )}
              </span>
              <span className="move-type-badge">{move.type}</span>
              <MoveMeta move={move} />
              <small className="move-pp" data-low={!!move.ppLeft && !!move.ppMax && move.ppLeft <= move.ppMax * 0.25}>
                {move.pp} PP
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
