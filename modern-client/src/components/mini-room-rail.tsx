import { Activity, MessageCircle, Swords } from 'lucide-react';
import { useArenaStore } from '../stores/arena-store';

const rooms = [
  { name: 'Lobby', detail: '1,284 users', icon: MessageCircle },
  { name: 'OverUsed', detail: 'Team discussion', icon: Activity },
  { name: 'Tournaments', detail: '3 active', icon: Swords },
];

const battles = [
  { name: 'Gen 9 OU', detail: 'Rivalry at turn 18', icon: Swords },
  { name: 'Random Battle', detail: 'Late-game endgame', icon: Swords },
  { name: 'VGC 2026', detail: 'Open team sheets', icon: Swords },
];

export function MiniRoomRail({ mode }: { mode: 'rooms' | 'battles' }) {
  const { rooms: liveRooms, battles: liveBattles, joinRoom } = useArenaStore();
  const roomItems = Object.values(liveRooms).length ?
    Object.values(liveRooms).slice(0, 6).map(room => ({
      name: room.title,
      detail: room.connected ? `${room.users.length} users` : 'Disconnected',
      icon: room.type === 'battle' ? Swords : MessageCircle,
      action: () => joinRoom(room.id),
    })) :
    rooms.map(room => ({ ...room, action: () => joinRoom(room.name) }));
  const battleItems = Object.values(liveBattles).filter(battle => battle.id !== 'demo-gen9ou').length ?
    Object.values(liveBattles).filter(battle => battle.id !== 'demo-gen9ou').slice(0, 6).map(battle => ({
      name: battle.format,
      detail: `${battle.p1.name} vs ${battle.p2.name}`,
      icon: Swords,
      action: undefined,
    })) :
    battles.map(battle => ({ ...battle, action: undefined }));
  const items = mode === 'rooms' ? roomItems : battleItems;

  return (
    <div className="mini-room-list">
      {items.map(item => {
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
      })}
    </div>
  );
}
