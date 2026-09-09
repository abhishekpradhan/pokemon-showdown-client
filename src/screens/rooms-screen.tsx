import { useNavigate } from '@tanstack/react-router';
import { Hash, RefreshCw, Search, Star, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';
import { useWorkspaceStore } from '../stores/workspace-store';

function roomTarget(value: string): string | null {
  let path = value.trim();
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      if (
        url.username ||
        url.password ||
        (!['play.pokemonshowdown.com', 'pokemonshowdown.com'].includes(url.hostname) &&
          url.origin !== location.origin)
      )
        return null;
      path = url.pathname;
    } catch {
      return null;
    }
  }
  const id = path
    .replace(/^\/(?:room|battle)\//, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');
  return /^[a-z0-9-]+$/.test(id) ? id : null;
}

/** Browse here; open conversations remain in the session tabs. */
export function RoomsScreen() {
  const navigate = useNavigate();
  const { chatRoomList, connection, focusRoom, joinRoom, refreshChatRooms } = useArenaStore(
    useShallow(state => ({
      chatRoomList: state.chatRoomList,
      connection: state.connection,
      focusRoom: state.focusRoom,
      joinRoom: state.joinRoom,
      refreshChatRooms: state.refreshChatRooms,
    })),
  );
  const [query, setQuery] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinError, setJoinError] = useState('');
  const joinErrorId = useId();
  const filterRef = useRef<HTMLInputElement>(null);
  const { favoriteRooms, setPreference } = useWorkspaceStore();
  const normalized = query.trim().toLowerCase();
  const chatSections = useMemo(() => {
    const visible = chatRoomList.rooms.filter(
      room => !normalized || `${room.title} ${room.id} ${room.desc || ''}`.toLowerCase().includes(normalized),
    );
    const order = chatRoomList.sectionTitles;
    const grouped = new Map<string, typeof visible>();
    for (const room of visible) {
      const key = room.section || 'Other';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(room);
    }
    return [...grouped.entries()].sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
    });
  }, [normalized, chatRoomList.rooms, chatRoomList.sectionTitles]);

  useEffect(() => {
    if (connection === 'connected') refreshChatRooms();
  }, [connection, refreshChatRooms]);

  const chooseRoom = (roomId: string) => {
    if (connection !== 'connected') return;
    joinRoom(roomId);
    focusRoom(roomId);
    if (roomId.startsWith('battle-'))
      void navigate({ to: '/battle/$battleId', params: { battleId: roomId } });
    else void navigate({ to: '/room/$roomId', params: { roomId } });
  };

  return (
    <section className="room-directory-surface" aria-label="Room directory">
      <header className="stage-heading directory-heading">
        <span>
          <small>Community</small>
          <h1>Rooms</h1>
        </span>
        <div className="directory-tools">
          <label className="pane-search">
            <Search size={15} aria-hidden />
            <input
              ref={filterRef}
              aria-label="Filter rooms"
              placeholder="Find a room"
              value={query}
              onChange={event => setQuery(event.currentTarget.value)}
            />
            {query && (
              <button
                type="button"
                className="conversation-icon"
                aria-label="Clear room filter"
                onClick={() => {
                  setQuery('');
                  filterRef.current?.focus();
                }}
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </label>
          <button
            type="button"
            className="pane-icon-button"
            aria-label="Refresh rooms"
            title="Refresh rooms"
            disabled={connection !== 'connected'}
            onClick={() => refreshChatRooms()}
          >
            <RefreshCw size={16} aria-hidden />
          </button>
        </div>
      </header>

      <form
        className="directory-join"
        onSubmit={event => {
          event.preventDefault();
          const id = roomTarget(joinName);
          if (!id) {
            setJoinError('Enter a room name or a Pokémon Showdown room link.');
            return;
          }
          setJoinError('');
          chooseRoom(id);
        }}
      >
        <label>
          <span>Join a room</span>
          <input
            aria-label="Room to join"
            value={joinName}
            onChange={event => {
              setJoinName(event.currentTarget.value);
              setJoinError('');
            }}
            placeholder="Room name or link"
            aria-invalid={!!joinError}
            aria-describedby={joinError ? joinErrorId : undefined}
          />
        </label>
        <button
          type="submit"
          className="secondary-action"
          disabled={!joinName.trim() || connection !== 'connected'}
        >
          Join room
        </button>
        {joinError && (
          <p id={joinErrorId} className="directory-join-error" role="alert">
            {joinError}
          </p>
        )}
      </form>
      {favoriteRooms.length > 0 && (
        <div className="directory-favorites" aria-label="Favorite rooms">
          <span>Saved</span>
          {favoriteRooms.map(id => (
            <button
              type="button"
              className="secondary-action"
              key={id}
              disabled={connection !== 'connected'}
              onClick={() => chooseRoom(id)}
            >
              {chatRoomList.rooms.find(room => room.id === id)?.title || id}
            </button>
          ))}
        </div>
      )}

      <div className="directory-chat">
        {chatSections.map(([section, sectionRooms]) => (
          <section key={section} aria-label={section}>
            <div className="directory-section-label">{section}</div>
            <div className="directory-grid">
              {sectionRooms.map(room => {
                const saved = favoriteRooms.includes(room.id);
                return (
                  <div key={room.id} className="directory-room-entry">
                    <button
                      type="button"
                      className="directory-card"
                      onClick={() => chooseRoom(room.id)}
                      title={room.desc}
                      disabled={connection !== 'connected'}
                    >
                      <span className="directory-card-title">
                        <Hash size={14} aria-hidden />
                        {room.title}
                      </span>
                      <small>{room.desc || 'Chat room'}</small>
                      <i>{room.userCount.toLocaleString()} online</i>
                    </button>
                    <button
                      type="button"
                      className="directory-favorite"
                      aria-label={`${saved ? 'Unfavorite' : 'Favorite'} ${room.title}`}
                      title={saved ? 'Remove from saved rooms' : 'Save room'}
                      aria-pressed={saved}
                      onClick={() =>
                        setPreference(
                          'favoriteRooms',
                          saved ? favoriteRooms.filter(id => id !== room.id) : [...favoriteRooms, room.id],
                        )
                      }
                    >
                      <Star size={17} aria-hidden fill={saved ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {!chatSections.length && (
          <div className="directory-empty">
            <p className="pane-empty">
              {connection !== 'connected'
                ? 'Connect to browse rooms.'
                : normalized
                  ? 'No rooms match your search.'
                  : 'The room directory is not available yet.'}
            </p>
            {normalized && (
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setQuery('');
                  filterRef.current?.focus();
                }}
              >
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
