import * as Dialog from '@radix-ui/react-dialog';
import { ListTree, Swords, Trophy, X } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { BracketNode, TournamentState } from '../rooms/types';

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
    return <div className="bracket-match is-seed"><span>{node.team || '—'}</span></div>;
  }
  return (
    <div className="bracket-match" data-state={node.state}>
      {sides.map((side, index) => (
        <span
          key={index}
          data-winner={!!node.team && !!side.team && node.team === side.team}
        >
          {side.team || 'TBD'}
          {node.score?.[index] !== undefined && <i>{node.score[index]}</i>}
        </span>
      ))}
    </div>
  );
}

export function TournamentBanner({ tournament, roomTitle, send }: {
  tournament: TournamentState;
  roomTitle: string;
  send: (command: string) => void;
}) {
  if (tournament.ended) return null;
  const stateLabel = tournament.isStarted ?
    'In progress' :
    `Signups open${tournament.playerCap ? ` · ${tournament.players.length}/${tournament.playerCap}` : tournament.players.length ? ` · ${tournament.players.length} joined` : ''}`;
  const rounds = tournament.bracketData?.type === 'tree' && tournament.bracketData.rootNode ?
    roundsFromTree(tournament.bracketData.rootNode) : [];

  return (
    <aside className="tournament-banner" aria-label={`Tournament in ${roomTitle}`}>
      <span className="tournament-title">
        <Trophy size={15} aria-hidden />
        <span>
          <strong>{tournament.format || 'Tournament'}</strong>
          <small>{tournament.generator || 'Tournament'} · {stateLabel}</small>
        </span>
      </span>
      <div className="tournament-actions">
        {tournament.currentBattle && (
          <Link className="primary-action" to="/battle/$battleId" params={{ battleId: tournament.currentBattle }}>
            <Swords size={13} aria-hidden /> Your match is live
          </Link>
        )}
        {!tournament.currentBattle && tournament.challenges.length > 0 && (
          <button type="button" className="primary-action" onClick={() => send(`/tour challenge ${tournament.challenges[0]}`)}>
            <Swords size={13} aria-hidden /> Challenge {tournament.challenges[0]}
          </button>
        )}
        {!tournament.currentBattle && !tournament.challenges.length && tournament.challengeBys.length > 0 && (
          <button type="button" className="primary-action" onClick={() => send('/tour acceptchallenge')}>
            <Swords size={13} aria-hidden /> Accept {tournament.challengeBys[0]}
          </button>
        )}
        {!tournament.isStarted && (
          tournament.isJoined ?
            <button type="button" className="secondary-action" onClick={() => send('/tour leave')}>Leave</button> :
            <button type="button" className="primary-action" onClick={() => send('/tour join')}>Join</button>
        )}
        {tournament.isStarted && tournament.isJoined && !tournament.currentBattle && (
          <button type="button" className="secondary-action" onClick={() => send('/tour leave')}>Forfeit tour</button>
        )}
        {rounds.length > 0 && (
          <Dialog.Root>
            <Dialog.Trigger asChild>
              <button type="button" className="secondary-action"><ListTree size={13} aria-hidden /> Bracket</button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="dialog-overlay" />
              <Dialog.Content className="account-dialog bracket-dialog">
                <div className="dialog-heading">
                  <div>
                    <Dialog.Title>{tournament.format || 'Tournament'} bracket</Dialog.Title>
                    <Dialog.Description>{tournament.generator} · {roomTitle}</Dialog.Description>
                  </div>
                  <Dialog.Close className="icon-button" aria-label="Close bracket"><X size={17} /></Dialog.Close>
                </div>
                <div className="bracket-scroll">
                  <div className="bracket-rounds">
                    {rounds.map((round, index) => (
                      <div className="bracket-round" key={index}>
                        <small>{index === rounds.length - 1 ? 'Final' : `Round ${index + 1}`}</small>
                        {round.map((node, matchIndex) => <BracketMatch node={node} key={matchIndex} />)}
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
