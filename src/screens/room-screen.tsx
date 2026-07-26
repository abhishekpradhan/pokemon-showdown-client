import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Hash, LogOut, MessageCircle, Send, Swords, Users } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChatFeed } from '../components/chat-feed';
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
  const { connection, focusRoom, formats, joinRoom, leaveRoom, rooms, selectedFormat, sendChallenge, sendRoomMessage, username } = useArenaStore(
    useShallow(state => ({
      connection: state.connection,
      focusRoom: state.focusRoom,
      formats: state.formats,
      joinRoom: state.joinRoom,
      leaveRoom: state.leaveRoom,
      rooms: state.rooms,
      selectedFormat: state.selectedFormat,
      sendChallenge: state.sendChallenge,
      sendRoomMessage: state.sendRoomMessage,
      username: state.username,
    }))
  );
  const room = rooms[params.roomId];
  const [message, setMessage] = useState('');
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
    if (!roomId && !params.roomId.startsWith('pm-') && connection === 'connected') joinRoom(params.roomId);
  }, [connection, focusRoom, joinRoom, params.roomId, roomId, roomConnected]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [room?.chat.length]);

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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;
    sendRoomMessage(room.id, message);
    setMessage('');
  };

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
              onClick={() => sendChallenge(room.partner)}
            >
              <Swords size={14} aria-hidden /> Challenge
            </button>
          )}
          {room.type !== 'pm' && room.users.length > 0 && (
            <span className="room-user-count"><Users size={14} aria-hidden /> {room.users.length.toLocaleString()}</span>
          )}
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              const next = nextRouteAfterClose(rooms, room.id);
              leaveRoom(room.id);
              void navigate({ to: next });
            }}
          >
            <LogOut size={14} aria-hidden /> Leave
          </button>
        </div>
      </header>

      <div className="room-surface-feed" ref={feedRef}>
        <ChatFeed
          messages={room.chat}
          selfName={username}
          onCommand={command => sendRoomMessage(room.id, command)}
        />
      </div>

      <form className="chat-entry room-surface-entry" onSubmit={submit}>
        <MessageCircle size={16} aria-hidden />
        <input
          aria-label={`Message ${room.title}`}
          placeholder={room.type === 'pm' ? `Message ${room.title}` : `Message ${room.title}`}
          value={message}
          onChange={event => setMessage(event.currentTarget.value)}
        />
        <button type="submit" aria-label="Send"><Send size={15} /></button>
      </form>
    </section>
  );
}
