import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Hash, LogOut, MessageCircle, Swords, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChatFeed } from '../components/chat-feed';
import { ChatComposer } from '../components/chat-composer';
import { openChallenge } from '../compat/ui-events';
import { TournamentBanner } from '../components/tournament-banner';
import { UserCard, type UserCardAnchor } from '../components/user-card';
import { JoiningState } from '../components/joining-state';
import { nextRouteAfterClose } from '../rooms/registry';
import { useArenaStore } from '../stores/arena-store';

/**
 * A chat or PM room as a full surface. Rooms open from the directory (or a
 * PM arriving) and live in the session tabs; this renders one of them.
 */
export function RoomScreen() {
  const params = useParams({ from: '/room/$roomId' });
  const navigate = useNavigate();
  const { connection, focusRoom, formats, joinRoom, leaveRoom, rooms, selectedFormat, sendRoomMessage, username } = useArenaStore(
    useShallow(state => ({
      connection: state.connection,
      focusRoom: state.focusRoom,
      formats: state.formats,
      joinRoom: state.joinRoom,
      leaveRoom: state.leaveRoom,
      rooms: state.rooms,
      selectedFormat: state.selectedFormat,
      sendRoomMessage: state.sendRoomMessage,
      username: state.username,
    }))
  );
  const room = rooms[params.roomId];
  const joinError = useArenaStore(state => state.roomErrors[params.roomId]);
  const [filter, setFilter] = useState('');
  const [roster, setRoster] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [lastSeen, setLastSeen] = useState<unknown>();
  const newMessages = !!room?.chat.length && room.chat.at(-1) !== lastSeen;
  const [userCard, setUserCard] = useState<UserCardAnchor | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const roomId = room?.id;
  const roomConnected = !!room?.connected;
  useEffect(() => {
    if (roomId && roomConnected) {
      focusRoom(roomId);
      return;
    }
    // Join only rooms we have no record of. A room that exists with
    // connected=false was left on purpose — rejoining it here would make
    // Leave a no-op (the trap this guard exists for).
    if (!roomId && (params.roomId.startsWith('pm-') || connection === 'connected') && !joinError) joinRoom(params.roomId);
  }, [connection, focusRoom, joinRoom, params.roomId, roomId, roomConnected, joinError]);

  useEffect(() => {
    if (atBottom) feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [room?.chat, atBottom]);

  if (joinError) return <section className="empty-state" role="alert"><h1>Unable to open this room</h1><p>{joinError}</p>
    <div className="button-row"><button type="button" className="secondary-action" onClick={() => joinRoom(params.roomId)}>Retry</button><Link to="/rooms">Browse rooms</Link></div></section>;

  if (room && !room.connected) {
    return (
      <section className="empty-state" aria-label="Room unavailable">
        <span className="eyebrow">Room session</span>
        <h1>You left this room</h1>
        <p>{room.title}</p>
        <div className="button-row">
          <Link to="/rooms" className="primary-action">Browse rooms</Link>
          <button type="button" className="secondary-action" onClick={() => joinRoom(room.id)}>
            Rejoin {room.title}
          </button>
        </div>
      </section>
    );
  }

  if (!room) {
    return (
      <JoiningState
        title={`Joining ${params.roomId}`}
        connected={connection === 'connected'}
        backTo="/rooms"
        backLabel="Browse rooms"
      />
    );
  }

  return (
    <section className="room-surface" aria-label={`Room ${room.title}`}>
      <header className="room-surface-heading">
        <span className="room-surface-title">
          {room.type === 'pm' ? <MessageCircle size={16} aria-hidden /> : <Hash size={16} aria-hidden />}
          <span>
            <h1>{room.title}</h1>
            <small>
              {room.type === 'pm' ? 'Private messages' :
                room.users.length ? `${room.users.length.toLocaleString()} users online` : 'Chat room'}
            </small>
          </span>
        </span>
        <div className="room-surface-actions">
          {room.type === 'pm' && (
            <button
              type="button"
              className="secondary-action"
              title={`Challenge to ${formats.find(format => format.id === selectedFormat)?.name || selectedFormat}`}
              onClick={() => openChallenge(room.partner)}
            >
              <Swords size={14} aria-hidden /> Challenge
            </button>
          )}
          {room.type !== 'pm' && room.users.length > 0 && (
            <button type="button" className="secondary-action" aria-expanded={roster} onClick={() => setRoster(value => !value)}><Users size={14} aria-hidden /> {room.users.length.toLocaleString()} users</button>
          )}
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              const next = nextRouteAfterClose(rooms, room.id);
              if (!leaveRoom(room.id)) return;
              void navigate({ to: next });
            }}
          >
            <LogOut size={14} aria-hidden /> Leave
          </button>
        </div>
      </header>

      <div className="room-history-tools">
        <input type="search" aria-label={roster ? 'Search room users' : 'Search chat history'} placeholder={roster ? 'Search users' : 'Search retained chat'} value={filter} onChange={event => setFilter(event.currentTarget.value)} />
        <button type="button" className="secondary-action" onClick={() => {
          const blob = new Blob([room.chat.map(entry => `${new Date(entry.timestamp || Date.now()).toISOString()} ${entry.user}: ${entry.kind === 'html' ? '[rich content]' : entry.message}`).join('\n')], { type: 'text/plain' });
          const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${room.id}-chat.txt`; link.click(); URL.revokeObjectURL(url);
        }}>Export chat</button>
        <small>Latest 2,000 messages retained locally in this session.</small>
      </div>
      {roster && <div className="room-roster" aria-label="Room users">{room.users.filter(user => user.toLowerCase().includes(filter.toLowerCase())).map(user => <button type="button" className="secondary-action" key={user} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setUserCard({ name: user, x: rect.left, y: rect.bottom, trigger: event.currentTarget }); }}>{user}</button>)}</div>}

      {room.type === 'chat' && room.tournament && (
        <TournamentBanner
          tournament={room.tournament}
          roomTitle={room.title}
          send={command => sendRoomMessage(room.id, command)}
        />
      )}

      <div className="room-surface-feed" ref={feedRef} onScroll={event => {
        const el = event.currentTarget; const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        setAtBottom(bottom); if (bottom) setLastSeen(room.chat.at(-1));
      }}>
        <ChatFeed
          key={room.id}
          announce={connection === 'connected' && (roster || !filter)}
          label={`${room.title} chat history`}
          messages={!roster && filter ? room.chat.filter(entry => `${entry.user} ${entry.message}`.toLowerCase().includes(filter.toLowerCase())) : room.chat}
          selfName={username}
          onCommand={command => sendRoomMessage(room.id, command)}
          onUserClick={(name, at) => setUserCard({ name, ...at })}
        />
      </div>
      {!atBottom && newMessages && <button type="button" className="secondary-action new-message-jump" onClick={() => { setAtBottom(true); setLastSeen(room.chat.at(-1)); }}>New messages · Jump to latest</button>}
      <ChatComposer key={room.id} roomId={room.id} title={room.title} users={room.users} send={message => sendRoomMessage(room.id, message)} />
      {userCard && <UserCard anchor={userCard} onClose={() => setUserCard(null)} />}
    </section>
  );
}
