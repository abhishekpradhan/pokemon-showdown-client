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
  const { activeRoomId, connection, focusRoom, joinRoom, leaveRoom, refreshRoomList, roomList, rooms, sendRoomMessage } = useArenaStore(
    useShallow(state => ({ activeRoomId: state.activeRoomId, connection: state.connection, focusRoom: state.focusRoom, joinRoom: state.joinRoom, leaveRoom: state.leaveRoom, refreshRoomList: state.refreshRoomList, roomList: state.roomList, rooms: state.rooms, sendRoomMessage: state.sendRoomMessage }))
  );
  const [selectedRoomId, setSelectedRoomId] = useState(() =>
    activeRoomId && !activeRoomId.startsWith('battle-') ? activeRoomId : 'lobby'
  );
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const joinedRooms = Object.values(rooms).filter(room => room.type !== 'battle');
  const selectedRoom = rooms[selectedRoomId] || rooms.lobby || joinedRooms[0];
  const directory = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return roomList.rooms
      .filter(room => !normalized || room.title.toLowerCase().includes(normalized) || room.id.includes(normalized))
      .slice(0, 60);
  }, [query, roomList.rooms]);

  useEffect(() => {
    if (connection === 'connected') refreshRoomList();
  }, [connection, refreshRoomList]);

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
          <button type="button" className="pane-icon-button" aria-label="Refresh rooms" onClick={() => refreshRoomList()}>
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
        <div className="directory-section-label">Public directory</div>
        <div className="public-room-list">
          {directory.map(room => {
            const isBattle = !!room.p1;
            return (
              <button type="button" className="directory-row" key={room.id} onClick={() => chooseRoom(room.id, isBattle)}>
                {isBattle ? <Swords size={14} aria-hidden /> : <Hash size={14} aria-hidden />}
                <span>
                  <strong>{room.title}</strong>
                  <small>{isBattle ? `${room.p1}${room.p2 ? ` vs ${room.p2}` : ''}` : `${room.users ?? 0} users`}</small>
                </span>
                <i>{isBattle ? 'Watch' : 'Join'}</i>
              </button>
            );
          })}
          {!directory.length && <p className="pane-empty">{connection === 'connected' ? 'No rooms match.' : 'Connect to load rooms.'}</p>}
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
