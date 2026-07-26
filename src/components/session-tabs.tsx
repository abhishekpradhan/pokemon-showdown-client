import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { Hash, MessageCircle, Swords, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { nextRouteAfterClose } from '../rooms/registry';
import { useArenaStore } from '../stores/arena-store';

/**
 * The one session model: every open room — battle, chat or PM — is a tab in
 * this strip, and nothing else in the app claims to list "what's open".
 * Pokémon Showdown players arrive with exactly this mental model.
 */
export function SessionTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const { focusRoom, leaveRoom, rooms, searchState } = useArenaStore(
    useShallow(state => ({
      focusRoom: state.focusRoom,
      leaveRoom: state.leaveRoom,
      rooms: state.rooms,
      searchState: state.searchState,
    }))
  );

  const open = Object.values(rooms).filter(room => room.connected && room.id !== 'lobby-preview');
  if (!open.length && searchState !== 'searching') return null;

  const iconFor = (type: string) =>
    type === 'battle' ? <Swords size={13} aria-hidden /> :
    type === 'pm' ? <MessageCircle size={13} aria-hidden /> :
    <Hash size={13} aria-hidden />;

  const routeFor = (roomId: string, type: string) =>
    type === 'battle' ? `/battle/${roomId}` : `/room/${roomId}`;

  const openRoom = (roomId: string, type: string) => {
    focusRoom(roomId);
    if (type === 'battle') {
      void navigate({ to: '/battle/$battleId', params: { battleId: roomId } });
    } else {
      void navigate({ to: '/room/$roomId', params: { roomId } });
    }
  };

  return (
    <nav className="session-tabs" aria-label="Open sessions">
      {searchState === 'searching' && (
        <Link to="/" className="session-tab is-searching">
          <span className="session-tab-live" role="img" aria-label="Searching" />
          <span className="session-tab-title">Searching…</span>
        </Link>
      )}
      {open.map(room => {
        const active = location.pathname === routeFor(room.id, room.type);
        const battle = room.type === 'battle' ? room.battle : null;
        const live = !!battle && !battle.ended;
        const title = room.type === 'battle' ?
          (battle && battle.p1.name !== 'Player 1' ? `${battle.p1.name} v ${battle.p2.name}` : room.title) :
          room.title;
        return (
          <span className={clsx('session-tab', active && 'is-active')} key={room.id}>
            <button
              type="button"
              className="session-tab-open"
              aria-current={active ? 'page' : undefined}
              onClick={() => openRoom(room.id, room.type)}
            >
              {iconFor(room.type)}
              <span className="session-tab-title">{title}</span>
              {live && <span className="session-tab-live" role="img" aria-label="Live" />}
              {room.unread > 0 && !active && <i className="session-tab-unread">{Math.min(room.unread, 99)}</i>}
            </button>
            <button
              type="button"
              className="session-tab-close"
              aria-label={`Close ${title}`}
              onClick={() => {
                const next = nextRouteAfterClose(rooms, room.id);
                leaveRoom(room.id);
                if (active) void navigate({ to: next });
              }}
            >
              <X size={12} />
            </button>
          </span>
        );
      })}
    </nav>
  );
}
