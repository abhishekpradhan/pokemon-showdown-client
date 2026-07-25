import { useNavigate } from '@tanstack/react-router';
import {
  ChevronRight,
  Hash,
  LogOut,
  MessageCircle,
  RefreshCw,
  Search,
  Swords,
  Users,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';

export function RoomsScreen() {
  const navigate = useNavigate();
  const {
    activeRoomId, chatRoomList, connection, focusRoom, joinRoom, leaveRoom,
    refreshChatRooms, refreshRoomList, roomList, rooms, sendRoomMessage,
  } = useArenaStore(
    useShallow(state => ({
      activeRoomId: state.activeRoomId, chatRoomList: state.chatRoomList, connection: state.connection,
      focusRoom: state.focusRoom, joinRoom: state.joinRoom, leaveRoom: state.leaveRoom,
      refreshChatRooms: state.refreshChatRooms, refreshRoomList: state.refreshRoomList,
      roomList: state.roomList, rooms: state.rooms, sendRoomMessage: state.sendRoomMessage,
    }))
  );
  const [selectedRoomId, setSelectedRoomId] = useState(() =>
    activeRoomId && !activeRoomId.startsWith('battle-') ? activeRoomId : 'lobby'
  );
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const joinedRooms = Object.values(rooms).filter(room => room.type !== 'battle');
  const selectedRoom = rooms[selectedRoomId] || rooms.lobby || joinedRooms[0];
  const normalized = query.trim().toLowerCase();
  const matches = (title: string, id: string) =>
    !normalized || title.toLowerCase().includes(normalized) || id.includes(normalized);

  // Chat rooms are the point of this screen; battles are secondary and live
  // under Battle. They come from different commands.
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
  const battleDirectory = useMemo(
    () => roomList.rooms.filter(room => matches(room.title, room.id)).slice(0, 30),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [normalized, roomList.rooms]
  );

  useEffect(() => {
    if (connection !== 'connected') return;
    refreshChatRooms();
    refreshRoomList();
  }, [connection, refreshChatRooms, refreshRoomList]);

  const chooseRoom = (roomId: string, isBattle = false) => {
    joinRoom(roomId);
    focusRoom(roomId);
    if (isBattle) {
      void navigate({ to: '/battle/$battleId', params: { battleId: roomId } });
      return;
    }
    setSelectedRoomId(roomId);
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRoom) return;
    sendRoomMessage(selectedRoom.id, message);
    setMessage('');
  };

  return (
    <section className="utility-workspace rooms-workspace" aria-label="Rooms">
      <aside className="workspace-pane room-directory">
        <header className="pane-heading">
          <span>
            <small>Community</small>
            <h1>Rooms</h1>
          </span>
          <button type="button" className="pane-icon-button" aria-label="Refresh rooms" onClick={() => { refreshChatRooms(); refreshRoomList(); }}>
            <RefreshCw size={15} />
          </button>
        </header>
        <label className="pane-search">
          <Search size={14} aria-hidden />
          <input aria-label="Filter rooms" placeholder="Filter rooms" value={query} onChange={event => setQuery(event.currentTarget.value)} />
        </label>
        <div className="directory-section-label">Open sessions</div>
        <div className="joined-room-list">
          {joinedRooms.map(room => (
            <button
              type="button"
              className={`directory-row ${selectedRoom?.id === room.id ? 'is-active' : ''}`}
              key={room.id}
              onClick={() => {
                focusRoom(room.id);
                setSelectedRoomId(room.id);
              }}
            >
              <MessageCircle size={14} aria-hidden />
              <span><strong>{room.title}</strong><small>{room.connected ? 'Joined' : 'Disconnected'}</small></span>
              {room.chat.length > 0 && <i>{room.chat.length}</i>}
            </button>
          ))}
          {!joinedRooms.length && <p className="pane-empty">No room sessions open.</p>}
        </div>
        {chatSections.map(([section, sectionRooms]) => (
          <div key={section}>
            <div className="directory-section-label">{section}</div>
            <div className="public-room-list">
              {sectionRooms.map(room => (
                <button type="button" className="directory-row" key={room.id} onClick={() => chooseRoom(room.id)} title={room.desc}>
                  <Hash size={14} aria-hidden />
                  <span>
                    <strong>{room.title}</strong>
                    <small>{room.desc || `${room.userCount.toLocaleString()} users`}</small>
                  </span>
                  <i>{room.userCount.toLocaleString()}</i>
                </button>
              ))}
            </div>
          </div>
        ))}
        {!chatSections.length && (
          <p className="pane-empty">{connection === 'connected' ? 'No chat rooms match.' : 'Connect to load rooms.'}</p>
        )}

        <div className="directory-section-label">Live battles</div>
        <div className="public-room-list">
          {battleDirectory.map(room => (
            <button type="button" className="directory-row" key={room.id} onClick={() => chooseRoom(room.id, true)}>
              <Swords size={14} aria-hidden />
              <span>
                <strong>{room.format || room.title}</strong>
                <small>{room.p1 ? `${room.p1} vs ${room.p2 || '?'}` : `${room.users ?? 0} users`}</small>
              </span>
              <i>Watch</i>
            </button>
          ))}
          {!battleDirectory.length && (
            <p className="pane-empty">{connection === 'connected' ? 'No battles match.' : 'Connect to load battles.'}</p>
          )}
        </div>
      </aside>

      <main className="workspace-stage room-stage">
        <header className="stage-heading room-stage-heading">
          <span>
            <small>{selectedRoom?.type || 'Room session'}</small>
            <h2>{selectedRoom?.title || 'Select a room'}</h2>
          </span>
          {selectedRoom && (
            <button type="button" className="secondary-action" onClick={() => {
              leaveRoom(selectedRoom.id);
              setSelectedRoomId('lobby');
            }}>
              <LogOut size={14} aria-hidden /> Leave
            </button>
          )}
        </header>

        <div className="room-transcript" role="log" aria-live="polite" aria-label="Room activity">
          {selectedRoom?.chat.length ? selectedRoom.chat.map((entry, index) => (
            <article className={`room-message is-${entry.kind || 'chat'}`} key={`${entry.user}-${entry.message}-${index}`}>
              <span className="message-avatar">{entry.user.slice(0, 1).toUpperCase()}</span>
              <span>
                <strong>{entry.user}</strong>
                <p>{entry.message}</p>
              </span>
              {entry.timestamp && <time>{new Date(entry.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>}
            </article>
          )) : (
            <div className="transcript-empty">
              <MessageCircle size={24} aria-hidden />
              <strong>{selectedRoom ? 'No messages yet.' : 'Choose a room from the directory.'}</strong>
              <span>Room history appears here while this session stays open.</span>
            </div>
          )}
        </div>

        <form className="room-composer" onSubmit={sendMessage}>
          <MessageCircle size={16} aria-hidden />
          <input
            aria-label="Room message"
            placeholder={selectedRoom ? `Message ${selectedRoom.title}` : 'Select a room to chat'}
            value={message}
            disabled={!selectedRoom}
            onChange={event => setMessage(event.currentTarget.value)}
          />
          <button type="submit" aria-label="Send room message" disabled={!selectedRoom || !message.trim()}>
            <ChevronRight size={17} />
          </button>
        </form>
      </main>

      <aside className="workspace-inspector member-inspector" aria-label="Room members">
        <header className="inspector-heading">
          <span>
            <small>Participants</small>
            <strong>{selectedRoom?.users.length || 0} users</strong>
          </span>
          <Users size={16} aria-hidden />
        </header>
        <div className="member-list">
          {selectedRoom?.users.map((user, index) => {
            const cleanUser = user.replace(/^[^a-zA-Z0-9]+/, '') || user;
            return (
              <div className="member-row" key={`${user}-${index}`}>
                <span>{cleanUser.slice(0, 1).toUpperCase()}</span>
                <strong>{cleanUser}</strong>
              </div>
            );
          })}
          {!selectedRoom?.users.length && <p className="pane-empty">The server has not sent a user list for this room.</p>}
        </div>
      </aside>
    </section>
  );
}
