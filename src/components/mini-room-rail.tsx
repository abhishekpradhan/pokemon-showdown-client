import { useNavigate } from '@tanstack/react-router';
import { Activity, MessageCircle, Swords } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';

export function MiniRoomRail({ mode }: { mode: 'rooms' | 'battles' }) {
  const navigate = useNavigate();
  const { rooms: liveRooms, battles: liveBattles, roomList, joinRoom, focusRoom, refreshRoomList, connection } = useArenaStore(
    useShallow(state => ({ rooms: state.rooms, battles: state.battles, roomList: state.roomList, joinRoom: state.joinRoom, focusRoom: state.focusRoom, refreshRoomList: state.refreshRoomList, connection: state.connection }))
  );
  const roomItems = Object.values(liveRooms).length ?
    Object.values(liveRooms).slice(0, 6).map(room => ({
      id: room.id,
      name: room.title,
      detail: room.connected ? `${room.users.length} users` : 'Disconnected',
      icon: room.type === 'battle' ? Swords : MessageCircle,
      action: () => {
        focusRoom(room.id);
        if (!room.connected) joinRoom(room.id);
        void navigate(room.type === 'battle' ? {
          to: '/battle/$battleId',
          params: { battleId: room.id },
        } : { to: '/rooms' });
      },
    })) :
    roomList.rooms.slice(0, 6).map(room => ({
      id: room.id,
      name: room.title,
      detail: room.p1 ? `${room.p1}${room.p2 ? ` vs ${room.p2}` : ''}` : `${room.users ?? 0} users`,
      icon: room.p1 ? Swords : MessageCircle,
      action: () => {
        joinRoom(room.id);
        void navigate(room.p1 ? {
          to: '/battle/$battleId',
          params: { battleId: room.id },
        } : { to: '/rooms' });
      },
    }));
  const battleItems = Object.values(liveBattles).filter(battle => battle.id !== 'demo-gen9ou').length ?
    Object.values(liveBattles).filter(battle => battle.id !== 'demo-gen9ou').slice(0, 6).map(battle => ({
      id: battle.id,
      name: battle.format,
      detail: `${battle.p1.name} vs ${battle.p2.name}`,
      icon: Swords,
      action: () => {
        focusRoom(battle.id);
        void navigate({ to: '/battle/$battleId', params: { battleId: battle.id } });
      },
    })) :
    roomList.rooms.filter(room => room.p1).slice(0, 6).map(room => ({
      id: room.id,
      name: room.format || 'Battle',
      detail: `${room.p1}${room.p2 ? ` vs ${room.p2}` : ''}`,
      icon: Swords,
      action: () => {
        joinRoom(room.id);
        void navigate({ to: '/battle/$battleId', params: { battleId: room.id } });
      },
    }));
  const items = mode === 'rooms' ? roomItems : battleItems;

  return (
    <div className="mini-room-list">
      {items.length ? items.map(item => {
        const Icon = item.icon;
        return (
          <button type="button" className="mini-room-row" key={item.id} onClick={item.action}>
            <Icon size={17} aria-hidden />
            <span>
              <strong>{item.name}</strong>
              <em>{item.detail}</em>
            </span>
          </button>
        );
      }) : (
        <button type="button" className="mini-room-row" onClick={() => connection === 'connected' && refreshRoomList()}>
          <Activity size={17} aria-hidden />
          <span>
            <strong>{connection === 'connected' ? 'Load live rooms' : 'Connect first'}</strong>
            <em>{connection === 'connected' ? 'Request roomlist' : 'Waiting for server'}</em>
          </span>
        </button>
      )}
    </div>
  );
}
