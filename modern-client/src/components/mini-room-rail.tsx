import { Activity, MessageCircle, Swords } from 'lucide-react';
import { useArenaStore } from '../stores/arena-store';

export function MiniRoomRail({ mode }: { mode: 'rooms' | 'battles' }) {
  const { rooms: liveRooms, battles: liveBattles, roomList, joinRoom, refreshRoomList, connection } = useArenaStore();
  const roomItems = Object.values(liveRooms).length ?
    Object.values(liveRooms).slice(0, 6).map(room => ({
      name: room.title,
      detail: room.connected ? `${room.users.length} users` : 'Disconnected',
      icon: room.type === 'battle' ? Swords : MessageCircle,
      action: () => joinRoom(room.id),
    })) :
    roomList.rooms.slice(0, 6).map(room => ({
      name: room.title,
      detail: room.p1 ? `${room.p1}${room.p2 ? ` vs ${room.p2}` : ''}` : `${room.users ?? 0} users`,
      icon: room.p1 ? Swords : MessageCircle,
      action: () => joinRoom(room.id),
    }));
  const battleItems = Object.values(liveBattles).filter(battle => battle.id !== 'demo-gen9ou').length ?
    Object.values(liveBattles).filter(battle => battle.id !== 'demo-gen9ou').slice(0, 6).map(battle => ({
      name: battle.format,
      detail: `${battle.p1.name} vs ${battle.p2.name}`,
      icon: Swords,
      action: undefined,
    })) :
    roomList.rooms.filter(room => room.p1).slice(0, 6).map(room => ({
      name: room.format || 'Battle',
      detail: `${room.p1}${room.p2 ? ` vs ${room.p2}` : ''}`,
      icon: Swords,
      action: () => joinRoom(room.id),
    }));
  const items = mode === 'rooms' ? roomItems : battleItems;

  return (
    <div className="mini-room-list">
      {items.length ? items.map(item => {
        const Icon = item.icon;
        return (
          <button type="button" className="mini-room-row" key={item.name} onClick={item.action}>
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
            <em>{connection === 'connected' ? 'Request roomlist' : 'No local fixture shown'}</em>
          </span>
        </button>
      )}
    </div>
  );
}
