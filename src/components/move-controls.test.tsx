import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { buildMoveDeck } from '../compat/battle-adapter';
import { MoveControls } from './move-controls';
import { TeamBench } from './team-bench';
import { BattleTimerChip } from './battle-timer';

afterEach(cleanup);

describe('battle decision controls', () => {
  it('exposes a Z move in a later slot and sends its modifier once', () => {
    const onChoose = vi.fn();
    const moves = buildMoveDeck(
      {
        rqid: 8,
        active: [
          {
            moves: [
              { move: 'Protect', target: 'self' },
              { move: 'Tackle', target: 'normal' },
            ],
            canZMove: [null, { move: 'Breakneck Blitz', target: 'normal' }],
          },
        ],
      },
      undefined,
      'gen7ou',
    );
    render(<MoveControls moves={moves} onChoose={onChoose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Z-Move' }));
    expect(screen.getByRole('button', { name: /^Protect, / })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /^Breakneck Blitz, / }));
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Breakneck Blitz', cmd: '/choose move 2 zmove|8' }),
    );
  });

  it('enables a legal Max move independently of its disabled base move', () => {
    const moves = buildMoveDeck(
      {
        rqid: 9,
        active: [
          {
            moves: [{ move: 'Protect', disabled: true, target: 'self' }],
            canDynamax: true,
            maxMoves: { maxMoves: [{ move: 'Max Guard', target: 'self' }] },
          },
        ],
      },
      undefined,
      'gen8ou',
    );
    render(<MoveControls moves={moves} onChoose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^Protect, / })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Dynamax' }));
    expect(screen.getByRole('button', { name: /^Max Guard, / })).toBeEnabled();
  });

  it('permits the first active Pokémon in preview and selected fainted targets in revival', () => {
    const team = [
      { slot: 1, name: 'Pikachu', species: 'Pikachu', hp: 100, active: true },
      { slot: 2, name: 'Bulbasaur', species: 'Bulbasaur', hp: 0, fainted: true },
    ];
    const choose = vi.fn();
    const { rerender } = render(<TeamBench team={team} preview onSwitch={choose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pikachu, 100% HP' }));
    expect(choose).toHaveBeenCalledWith(team[0]);
    rerender(<TeamBench team={team} allowedSlots={[2]} onSwitch={choose} />);
    expect(screen.getByRole('button', { name: /Pikachu, 100% HP/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Bulbasaur, fainted' }));
    expect(choose).toHaveBeenLastCalledWith(team[1]);
  });

  it('opens persistent inspection without submitting a move', () => {
    const choose = vi.fn();
    const moves = buildMoveDeck({ active: [{ moves: [{ move: 'Tackle' }] }] }, undefined);
    render(<MoveControls moves={moves} onChoose={choose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Tackle' }));
    expect(screen.getByRole('dialog', { name: 'Tackle' })).toBeVisible();
    expect(choose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not show a ticking decision clock after submission or the end', () => {
    const timer = { on: true, secondsLeft: 50, asOf: Date.now() };
    const { rerender } = render(<BattleTimerChip timer={timer} running={false} />);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByText('Timer on · waiting')).toBeVisible();
    rerender(<BattleTimerChip timer={timer} ended />);
    expect(screen.queryByText(/Timer/)).not.toBeInTheDocument();
  });
});
