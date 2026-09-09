import * as Dialog from '@radix-ui/react-dialog';
import { ListTree, Swords, Trophy, X } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { BracketNode, TournamentState } from '../rooms/types';
import { useArenaStore } from '../stores/arena-store';
import { toId } from '../compat/protocol-parsers';
import { useState } from 'react';

/**
 * The room's running tournament, as a banner above the chat: what it is,
 * whether you're in it, and the one action that matters right now —
 * join/leave during signups, challenge/accept once your round is up, or the
 * link to your live match. The bracket renders in a dialog, round columns
 * from the server's tree.
 */

/** Flattens the elimination tree into rounds, finals last. */
const roundsFromTree = (root: BracketNode): BracketNode[][] => {
  const rounds: BracketNode[][] = [];
  let layer = [root];
  while (layer.length) {
    rounds.push(layer);
    layer = layer.flatMap(node => node.children ?? []);
  }
  rounds.reverse();
  // The deepest layer is bare seeds; the first match column already names
  // them, so a separate column would just repeat every player.
  if (rounds.length > 1 && rounds[0].every(node => !node.children?.length)) rounds.shift();
  return rounds;
};

function BracketMatch({ node }: { node: BracketNode }) {
  const sides = node.children ?? [];
  if (!sides.length) {
    return (
      <div className="bracket-match is-seed">
        <span>{node.team || '—'}</span>
      </div>
    );
  }
  return (
    <div className="bracket-match" data-state={node.state}>
      {sides.map((side, index) => (
        <span key={index} data-winner={!!node.team && !!side.team && node.team === side.team}>
          {side.team || 'TBD'}
          {node.score?.[index] !== undefined && <i>{node.score[index]}</i>}
        </span>
      ))}
    </div>
  );
}

export function TournamentBanner({
  tournament,
  roomTitle,
  send,
}: {
  tournament: TournamentState;
  roomTitle: string;
  send: (command: string) => void;
}) {
  const teams = useArenaStore(state => state.teams);
  const formats = useArenaStore(state => state.formats);
  const [teamId, setTeamId] = useState(useArenaStore.getState().activeTeamId || '');
  const [error, setError] = useState('');
  const format = toId(tournament.teambuilderFormat || tournament.format);
  const requiresTeam = formats.find(entry => entry.id === format)?.team !== false;
  const play = (command: string) => {
    const state = useArenaStore.getState();
    if (state.connection !== 'connected' || !state.named) {
      setError('Connect and choose a name before playing.');
      return;
    }
    if (requiresTeam) {
      const team = teams.find(entry => entry.id === teamId);
      const validation = state.validateTeamForFormat(teamId, format);
      if (!team || !validation.ok) {
        setError(validation.errors.join(' ') || 'Select a team for this tournament.');
        return;
      }
      if (state.protocol.send(`/utm ${team.packed}`) === false) return;
    }
    setError('');
    send(command);
  };
  if (tournament.ended)
    return (
      <aside className="tournament-banner" aria-label={`Tournament in ${roomTitle}`}>
        <strong>{tournament.format} · Tournament ended</strong>
        {tournament.results?.[0]?.length ? <span>Winner: {tournament.results[0].join(', ')}</span> : null}
      </aside>
    );
  const stateLabel = tournament.isStarted
    ? 'In progress'
    : `Signups open${tournament.playerCap ? ` · ${tournament.players.length}/${tournament.playerCap}` : tournament.players.length ? ` · ${tournament.players.length} joined` : ''}`;
  const rounds =
    tournament.bracketData?.type === 'tree' && tournament.bracketData.rootNode
      ? roundsFromTree(tournament.bracketData.rootNode)
      : [];

  return (
    <aside className="tournament-banner" aria-label={`Tournament in ${roomTitle}`}>
      <span className="tournament-title">
        <Trophy size={15} aria-hidden />
        <span>
          <strong>{tournament.format || 'Tournament'}</strong>
          <small>
            {tournament.generator || 'Tournament'} · {stateLabel}
          </small>
        </span>
      </span>
      <div className="tournament-actions">
        {tournament.isJoined && requiresTeam && (
          <select
            aria-label="Tournament team"
            value={teamId}
            onChange={event => setTeamId(event.currentTarget.value)}
          >
            <option value="">Choose team</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.name} · {team.format}
              </option>
            ))}
          </select>
        )}
        {(error || tournament.error) && <p role="alert">{error || tournament.error}</p>}
        {tournament.challenging && (
          <span>
            Waiting for {tournament.challenging}{' '}
            <button type="button" className="secondary-action" onClick={() => send('/tour cancelchallenge')}>
              Cancel challenge
            </button>
          </span>
        )}
        {tournament.currentBattle && (
          <Link
            className="primary-action"
            to="/battle/$battleId"
            params={{ battleId: tournament.currentBattle }}
          >
            <Swords size={13} aria-hidden /> Your match is live
          </Link>
        )}
        {!tournament.currentBattle &&
          !tournament.challenging &&
          !tournament.challenged &&
          tournament.challenges.length > 0 && (
            <button
              type="button"
              className="primary-action"
              onClick={() => play(`/tour challenge ${tournament.challenges[0]}`)}
            >
              <Swords size={13} aria-hidden /> Challenge {tournament.challenges[0]}
            </button>
          )}
        {!tournament.currentBattle && tournament.challenged && (
          <button type="button" className="primary-action" onClick={() => play('/tour acceptchallenge')}>
            <Swords size={13} aria-hidden /> Accept {tournament.challenged}
          </button>
        )}
        {!tournament.challenged && !tournament.currentBattle && tournament.challengeBys.length > 0 && (
          <small>Waiting for {tournament.challengeBys.join(', ')} to challenge you.</small>
        )}
        {!tournament.isStarted &&
          (tournament.isJoined ? (
            <button type="button" className="secondary-action" onClick={() => send('/tour leave')}>
              Leave
            </button>
          ) : (
            <button type="button" className="primary-action" onClick={() => send('/tour join')}>
              Join
            </button>
          ))}
        {tournament.isStarted && tournament.isJoined && !tournament.currentBattle && (
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              if (window.confirm('Leave and forfeit this tournament?')) send('/tour leave');
            }}
          >
            Forfeit tour
          </button>
        )}
        {(rounds.length > 0 || tournament.bracketData?.type === 'table') && (
          <Dialog.Root>
            <Dialog.Trigger asChild>
              <button type="button" className="secondary-action">
                <ListTree size={13} aria-hidden /> Bracket
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="dialog-overlay" />
              <Dialog.Content className="account-dialog bracket-dialog">
                <div className="dialog-heading">
                  <div>
                    <Dialog.Title>{tournament.format || 'Tournament'} bracket</Dialog.Title>
                    <Dialog.Description>
                      {tournament.generator} · {roomTitle}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close className="icon-button" aria-label="Close bracket">
                    <X size={17} />
                  </Dialog.Close>
                </div>
                <div className="bracket-scroll">
                  {tournament.bracketData?.type === 'table' && (
                    <table>
                      <caption>Round-robin results</caption>
                      <thead>
                        <tr>
                          <th scope="col">Player</th>
                          {tournament.bracketData.tableHeaders?.cols.map((col, index) => (
                            <th scope="col" key={index}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tournament.bracketData.tableContents?.map((row, index) => (
                          <tr key={index}>
                            <th scope="row">{tournament.bracketData?.tableHeaders?.rows[index]}</th>
                            {row.map((cell, col) => (
                              <td key={col}>
                                {cell
                                  ? [cell.result || cell.state || 'Pending', cell.score?.join('–')]
                                      .filter(Boolean)
                                      .join(' ')
                                  : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="bracket-rounds">
                    {rounds.map((round, index) => (
                      <div className="bracket-round" key={index}>
                        <small>{index === rounds.length - 1 ? 'Final' : `Round ${index + 1}`}</small>
                        {round.map((node, matchIndex) => (
                          <BracketMatch node={node} key={matchIndex} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </div>
    </aside>
  );
}
