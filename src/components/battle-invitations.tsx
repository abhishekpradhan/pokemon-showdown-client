import { useState } from 'react';
import type { BattleRoom } from '../rooms/types';
import type { BattleSideID } from '../compat/battle-adapter';
import { useArenaStore } from '../stores/arena-store';

export function BattleInvitations({ room }: { room: BattleRoom }) {
  const [names, setNames] = useState<Partial<Record<BattleSideID, string>>>({});
  const [error, setError] = useState('');
  const connected = useArenaStore(state => state.connection === 'connected' && state.named);
  if (!room.invitations?.length || room.result?.ended) return null;
  return (
    <section className="battle-invitations" aria-label="Battle invitations">
      <header>
        <strong>Complete the battle roster</strong>
        <p>Invite players to the remaining seats. The battle starts when everyone joins.</p>
      </header>
      <div className="battle-invitation-slots">
        {room.invitations.map(seat => (
          <form
            key={seat.slot}
            onSubmit={event => {
              event.preventDefault();
              const state = useArenaStore.getState();
              if (state.inviteBattlePlayer(room.id, seat.slot, names[seat.slot] || '')) {
                setNames(current => ({ ...current, [seat.slot]: '' }));
                setError('');
              } else setError(useArenaStore.getState().lastError || 'The invitation could not be sent.');
            }}
          >
            <label htmlFor={`${room.id}-${seat.slot}-invite`}>
              {seat.slot.toUpperCase()}
              {room.battle.gameType === 'multi'
                ? ` · Team ${seat.slot === 'p1' || seat.slot === 'p3' ? '1' : '2'}`
                : ''}
            </label>
            {seat.canInvite ? (
              <>
                <input
                  id={`${room.id}-${seat.slot}-invite`}
                  aria-label={`Player for seat ${seat.slot}`}
                  placeholder="Username"
                  autoComplete="off"
                  maxLength={18}
                  value={names[seat.slot] || ''}
                  onChange={event => {
                    const value = event.currentTarget.value;
                    setNames(current => ({ ...current, [seat.slot]: value }));
                  }}
                />
                <button
                  type="submit"
                  className="secondary-action"
                  disabled={!connected || !names[seat.slot]?.trim()}
                >
                  Invite to {seat.slot}
                </button>
              </>
            ) : (
              <>
                <span>
                  {seat.name || seat.invited}
                  {seat.invited ? ' · Invited' : ' · Joined'}
                </span>
                {seat.invited && (
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={!connected}
                    onClick={() => {
                      if (useArenaStore.getState().revokeBattleInvitation(room.id, seat.slot)) setError('');
                      else
                        setError(
                          useArenaStore.getState().lastError || 'The invitation could not be removed.',
                        );
                    }}
                  >
                    Uninvite {seat.invited}
                  </button>
                )}
              </>
            )}
          </form>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
