import { useNavigate } from '@tanstack/react-router';
import { Hash, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';

/**
 * The room directory: browse and join. Open rooms live in the session tabs
 * and render at /room/:id — this screen deliberately does not host chat, so
 * there is exactly one place a conversation appears.
 */
export function RoomsScreen() {
  const navigate = useNavigate();
  const { chatRoomList, connection, focusRoom, joinRoom, refreshChatRooms } = useArenaStore(
    useShallow(state => ({
      chatRoomList: state.chatRoomList,
      connection: state.connection,
      focusRoom: state.focusRoom,
      joinRoom: state.joinRoom,
      refreshChatRooms: state.refreshChatRooms,
    }))
  );
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const matches = (title: string, id: string) =>
    !normalized || title.toLowerCase().includes(normalized) || id.includes(normalized);

  // Grouped by the server's own sections, in the server's own order.
  const chatSections = useMemo(() => {
    const visible = chatRoomList.rooms.filter(room => matches(room.title, room.id));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized, chatRoomList.rooms, chatRoomList.sectionTitles]);

  useEffect(() => {
    if (connection !== 'connected') return;
    refreshChatRooms();
  }, [connection, refreshChatRooms]);

  const chooseRoom = (roomId: string, isBattle = false) => {
    joinRoom(roomId);
    focusRoom(roomId);
    if (isBattle) {
      void navigate({ to: '/battle/$battleId', params: { battleId: roomId } });
      return;
    }
    void navigate({ to: '/room/$roomId', params: { roomId } });
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
            <Search size={14} aria-hidden />
            <input
              aria-label="Filter rooms"
              placeholder="Filter rooms and battles"
              value={query}
              onChange={event => setQuery(event.currentTarget.value)}
            />
          </label>
          <button
            type="button"
            className="pane-icon-button"
            aria-label="Refresh rooms"
            onClick={() => refreshChatRooms()}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      <div className="directory-columns">
        <div className="directory-chat">
          {chatSections.map(([section, sectionRooms]) => (
            <section key={section} aria-label={section}>
              <div className="directory-section-label">{section}</div>
              <div className="directory-grid">
                {sectionRooms.map(room => (
                  <button
                    type="button"
                    className="directory-card"
                    key={room.id}
                    onClick={() => chooseRoom(room.id)}
                    title={room.desc}
                  >
                    <span className="directory-card-title"><Hash size={13} aria-hidden /> {room.title}</span>
                    <small>{room.desc || 'Chat room'}</small>
                    <i>{room.userCount.toLocaleString()} online</i>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {!chatSections.length && (
            <p className="pane-empty">{connection === 'connected' ? 'No chat rooms match.' : 'Connect to load rooms.'}</p>
          )}
        </div>

      </div>
    </section>
  );
}
