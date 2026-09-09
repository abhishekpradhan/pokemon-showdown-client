import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Download, Hash, LogOut, MessageCircle, Search, Swords, Users, X } from 'lucide-react';
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
  return <RoomConversation key={params.roomId} requestedRoomId={params.roomId} />;
}

function RoomConversation({ requestedRoomId }: { requestedRoomId: string }) {
  const navigate = useNavigate();
  const {
    connection,
    focusRoom,
    formats,
    joinRoom,
    leaveRoom,
    rooms,
    selectedFormat,
    sendRoomMessage,
    username,
  } = useArenaStore(
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
    })),
  );
  const room = rooms[requestedRoomId];
  const joinError = useArenaStore(state => state.roomErrors[requestedRoomId]);
  const [historyFilter, setHistoryFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const historyQuery = historyFilter.trim().toLowerCase();
  const [roster, setRoster] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [lastSeen, setLastSeen] = useState<unknown>();
  const newMessages = !!room?.chat.length && room.chat.at(-1) !== lastSeen;
  const [userCard, setUserCard] = useState<UserCardAnchor | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const historySearchRef = useRef<HTMLInputElement>(null);
  const usersButtonRef = useRef<HTMLButtonElement>(null);

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
    if (!roomId && (requestedRoomId.startsWith('pm-') || connection === 'connected') && !joinError)
      joinRoom(requestedRoomId);
  }, [connection, focusRoom, joinRoom, requestedRoomId, roomId, roomConnected, joinError]);

  useEffect(() => {
    if (atBottom && !historyQuery) feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [room?.chat, atBottom, historyQuery]);

  useEffect(() => {
    if (historyQuery) feedRef.current?.scrollTo({ top: 0 });
  }, [historyQuery]);

  if (joinError)
    return (
      <section className="empty-state" role="alert">
        <h1>Unable to open this room</h1>
        <p>{joinError}</p>
        <div className="button-row">
          <button type="button" className="secondary-action" onClick={() => joinRoom(requestedRoomId)}>
            Retry
          </button>
          <Link to="/rooms">Browse rooms</Link>
        </div>
      </section>
    );

  if (room && !room.connected) {
    return (
      <section className="empty-state" aria-label="Room unavailable">
        <span className="eyebrow">Room session</span>
        <h1>You left this room</h1>
        <p>{room.title}</p>
        <div className="button-row">
          <Link to="/rooms" className="primary-action">
            Browse rooms
          </Link>
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
        title={`Joining ${requestedRoomId}`}
        connected={connection === 'connected'}
        backTo="/rooms"
        backLabel="Browse rooms"
      />
    );
  }

  const visibleMessages = historyQuery
    ? room.chat.filter(entry => `${entry.user} ${entry.message}`.toLowerCase().includes(historyQuery))
    : room.chat;
  const visibleUsers = room.users.filter(user =>
    user.toLowerCase().includes(userFilter.trim().toLowerCase()),
  );

  return (
    <section className="room-surface" aria-label={`Room ${room.title}`}>
      <header className="room-surface-heading">
        <span className="room-surface-title">
          {room.type === 'pm' ? <MessageCircle size={16} aria-hidden /> : <Hash size={16} aria-hidden />}
          <span>
            <h1>{room.title}</h1>
            <small>{room.type === 'pm' ? 'Private messages' : 'Chat room'}</small>
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
            <button
              ref={usersButtonRef}
              type="button"
              className="secondary-action"
              aria-expanded={roster}
              aria-controls={`room-users-${room.id}`}
              onClick={() => setRoster(value => !value)}
            >
              <Users size={14} aria-hidden /> {room.users.length.toLocaleString()} users
            </button>
          )}
          <button
            type="button"
            className="secondary-action"
            aria-label={room.type === 'pm' ? 'Close conversation' : 'Leave room'}
            title={room.type === 'pm' ? 'Close conversation' : 'Leave room'}
            onClick={() => {
              const next = nextRouteAfterClose(rooms, room.id);
              if (!leaveRoom(room.id)) return;
              void navigate({ to: next });
            }}
          >
            {room.type === 'pm' ? <X size={14} aria-hidden /> : <LogOut size={14} aria-hidden />}
            <span className="room-close-label">{room.type === 'pm' ? 'Close' : 'Leave'}</span>
          </button>
        </div>
      </header>

      <div className="room-history-tools conversation-tools">
        <label className="conversation-search">
          <Search size={15} aria-hidden />
          <input
            ref={historySearchRef}
            type="search"
            aria-label="Search chat history"
            placeholder="Search messages"
            value={historyFilter}
            onChange={event => {
              setHistoryFilter(event.currentTarget.value);
              setAtBottom(!event.currentTarget.value.trim());
            }}
          />
          {historyFilter && (
            <button
              type="button"
              className="conversation-icon"
              aria-label="Clear chat search"
              onClick={() => {
                setHistoryFilter('');
                setAtBottom(true);
                historySearchRef.current?.focus();
              }}
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </label>
        <small role="status" aria-label="Chat search results">
          {historyQuery
            ? `${visibleMessages.length} ${visibleMessages.length === 1 ? 'result' : 'results'}`
            : 'This session'}
        </small>
        <button
          type="button"
          className="secondary-action conversation-export"
          aria-label="Export chat"
          title="Export up to 2,000 messages from this session"
          disabled={!room.chat.length}
          onClick={() => {
            const blob = new Blob(
              [
                room.chat
                  .map(
                    entry =>
                      `${new Date(entry.timestamp || Date.now()).toISOString()} ${entry.user}: ${entry.kind === 'html' ? '[rich content]' : entry.message}`,
                  )
                  .join('\n'),
              ],
              { type: 'text/plain' },
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${room.id}-chat.txt`;
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={15} aria-hidden />
          <span>Export chat</span>
        </button>
      </div>
      {roster && (
        <section id={`room-users-${room.id}`} className="conversation-roster" aria-label="Room users">
          <div className="conversation-roster-tools">
            <label className="conversation-search">
              <Search size={15} aria-hidden />
              <input
                type="search"
                aria-label="Search room users"
                placeholder="Find a user"
                value={userFilter}
                onChange={event => setUserFilter(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              className="conversation-icon"
              aria-label="Close user list"
              onClick={() => {
                setRoster(false);
                usersButtonRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <div className="room-roster">
            {visibleUsers.map(user => (
              <button
                type="button"
                className="secondary-action"
                key={user}
                onClick={event => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setUserCard({ name: user, x: rect.left, y: rect.bottom, trigger: event.currentTarget });
                }}
              >
                {user}
              </button>
            ))}
            {!visibleUsers.length && <p className="chat-empty">No users match your search.</p>}
          </div>
        </section>
      )}

      {room.type === 'chat' && room.tournament && (
        <TournamentBanner
          tournament={room.tournament}
          roomTitle={room.title}
          send={command => sendRoomMessage(room.id, command)}
        />
      )}

      <div
        className="room-surface-feed"
        ref={feedRef}
        onScroll={event => {
          const el = event.currentTarget;
          const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          if (bottom || atBottom) setLastSeen(room.chat.at(-1));
          setAtBottom(bottom);
        }}
      >
        <ChatFeed
          key={room.id}
          announce={connection === 'connected' && !historyQuery}
          label={`${room.title} chat history`}
          messages={visibleMessages}
          emptyText={historyQuery ? 'No messages match your search.' : 'No messages yet.'}
          selfName={username}
          onCommand={command => sendRoomMessage(room.id, command)}
          onUserClick={(name, at) => setUserCard({ name, ...at })}
        />
      </div>
      {!atBottom && !historyQuery && newMessages && (
        <button
          type="button"
          className="secondary-action new-message-jump"
          onClick={() => {
            setAtBottom(true);
            setLastSeen(room.chat.at(-1));
          }}
        >
          New messages · Jump to latest
        </button>
      )}
      <ChatComposer
        key={room.id}
        roomId={room.id}
        title={room.title}
        users={room.users}
        send={message => sendRoomMessage(room.id, message)}
      />
      {userCard && <UserCard anchor={userCard} onClose={() => setUserCard(null)} />}
    </section>
  );
}
