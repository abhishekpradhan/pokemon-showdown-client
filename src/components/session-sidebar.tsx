import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { CircleDot, MessageCircle, Plus, Radio, Swords, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';
import { ConnectionPill } from './status-pills';

export function SessionSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeRoomId, connection, focusRoom, leaveRoom, rooms, searchFormats, searchState } = useArenaStore(
    useShallow(state => ({ activeRoomId: state.activeRoomId, connection: state.connection, focusRoom: state.focusRoom, leaveRoom: state.leaveRoom, rooms: state.rooms, searchFormats: state.searchFormats, searchState: state.searchState }))
  );
  const battleSessions = Object.values(rooms)
    .filter(room => room.type === 'battle')
    .map(room => (room as import('../rooms/types').BattleRoom).battle);
  const roomSessions = Object.values(rooms)
    .filter(room => room.type !== 'battle' && room.connected);
  const hasSessions = battleSessions.length > 0 || roomSessions.length > 0;

  return (
    <aside className="session-sidebar" aria-label="Open sessions">
      <div className="session-sidebar-heading">
        <span>Sessions</span>
        <Link to="/rooms" className="session-add" aria-label="Find a room">
          <Plus size={15} />
        </Link>
      </div>

      <div className="session-list">
        <Link
          to="/"
          className={clsx('session-item', location.pathname === '/' && 'is-active')}
          onClick={() => focusRoom(undefined)}
        >
          <span className="session-mark"><CircleDot size={15} /></span>
          <span>
            <strong>Matchmaking</strong>
            <small>{searchState === 'searching' ? `Searching ${searchFormats[0] || ''}` : 'Queue console'}</small>
          </span>
          {searchState === 'searching' && <i className="session-live-dot" role="img" aria-label="Searching" />}
        </Link>

        {battleSessions.map(battle => (
          <div className="session-row" key={battle.id}>
            <button
              type="button"
              className={clsx('session-item', (activeRoomId === battle.id || location.pathname === `/battle/${battle.id}`) && 'is-active')}
              onClick={() => {
                focusRoom(battle.id);
                void navigate({ to: '/battle/$battleId', params: { battleId: battle.id } });
              }}
            >
              <span className="session-mark"><Swords size={15} /></span>
              <span>
                <strong>{battle.p1.name} · {battle.p2.name}</strong>
                <small>{battle.ended ? battle.winner ? `${battle.winner} won` : 'Battle ended' : `Turn ${battle.turn || '—'} · ${battle.format}`}</small>
              </span>
              {!battle.ended && <i className="session-live-dot" role="img" aria-label="Live" />}
            </button>
            {battle.id !== 'demo-gen9ou' && (
              <button className="session-close" type="button" aria-label={`Leave ${battle.id}`} onClick={() => leaveRoom(battle.id)}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}

        {roomSessions.map(room => (
          <div className="session-row" key={room.id}>
            <button
              type="button"
              className={clsx('session-item', activeRoomId === room.id && 'is-active')}
              onClick={() => {
                focusRoom(room.id);
                void navigate({ to: '/rooms' });
              }}
            >
              <span className="session-mark"><MessageCircle size={15} /></span>
              <span>
                <strong>{room.title}</strong>
                <small>{room.users.length ? `${room.users.length} users` : 'Chat room'}</small>
              </span>
            </button>
            <button className="session-close" type="button" aria-label={`Leave ${room.title}`} onClick={() => leaveRoom(room.id)}>
              <X size={13} />
            </button>
          </div>
        ))}

        {!hasSessions && (
          <div className="session-empty">
            <Radio size={16} aria-hidden />
            <p>Battle and room sessions stay open here.</p>
          </div>
        )}
      </div>

      <div className="session-connection">
        <ConnectionPill state={connection} />
        <small>play.pokemonshowdown.com</small>
      </div>
    </aside>
  );
}
