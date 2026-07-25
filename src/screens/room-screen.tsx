import { Link, useParams } from '@tanstack/react-router';
import { Hash, LogOut, MessageCircle, Send, Swords, Users } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChatFeed } from '../components/chat-feed';
import { useArenaStore } from '../stores/arena-store';

/**
 * A chat or PM room as a full surface. Rooms open from the directory (or a
 * PM arriving) and live in the session tabs; this renders one of them.
 */
export function RoomScreen() {
  const params = useParams({ from: '/room/$roomId' });
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
  useEffect(() => {
    if (roomId) {
      focusRoom(roomId);
      return;
    }
    // PMs are local constructs; only server rooms can be joined.
    if (!params.roomId.startsWith('pm-') && connection === 'connected') joinRoom(params.roomId);
  }, [connection, focusRoom, joinRoom, params.roomId, roomId]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [room?.chat.length]);

  if (!room) {
    return (
      <section className="empty-state" aria-label="Room unavailable">
        <span className="eyebrow">Room session</span>
        <h1>{connection === 'connected' ? 'Joining room…' : 'Room unavailable'}</h1>
        <p>{connection === 'connected' ? params.roomId : 'Connect to the server to join rooms.'}</p>
        <Link to="/rooms" className="primary-action">Browse rooms</Link>
      </section>
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
          <button type="button" className="secondary-action" onClick={() => leaveRoom(room.id)}>
            <LogOut size={14} aria-hidden /> Leave
          </button>
        </div>
      </header>

      <div className="room-surface-feed" ref={feedRef}>
        <ChatFeed messages={room.chat} selfName={username} />
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
