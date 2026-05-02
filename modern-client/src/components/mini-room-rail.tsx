import { Activity, MessageCircle, Swords } from 'lucide-react';

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
  const items = mode === 'rooms' ? rooms : battles;

  return (
    <div className="mini-room-list">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <button type="button" className="mini-room-row" key={item.name}>
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
