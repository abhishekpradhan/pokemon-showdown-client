import { BookOpen, KeyRound, MessageCircle, Settings, Shield, Trophy, Users } from 'lucide-react';
import { TeamBench } from '../components/team-bench';
import { useArenaStore } from '../stores/arena-store';

type UtilityView = 'teambuilder' | 'rooms' | 'ladder' | 'replays' | 'settings';

const viewMeta: Record<UtilityView, { title: string; eyebrow: string; icon: typeof Shield; body: string }> = {
  teambuilder: {
    title: 'Teambuilder',
    eyebrow: 'Teams',
    icon: Shield,
    body: 'Import, validate, and prepare teams for PS-compatible formats.',
  },
  rooms: {
    title: 'Rooms',
    eyebrow: 'Community',
    icon: Users,
    body: 'Join chat rooms, PMs, and tournament spaces without leaving the battle-ready shell.',
  },
  ladder: {
    title: 'Ladder',
    eyebrow: 'Ranked',
    icon: Trophy,
    body: 'Track format standings and rating changes with fast filters and clear account state.',
  },
  replays: {
    title: 'Replays',
    eyebrow: 'Review',
    icon: BookOpen,
    body: 'Load, scrub, upload, and share battle logs while preserving existing replay compatibility.',
  },
  settings: {
    title: 'Settings',
    eyebrow: 'Client',
    icon: Settings,
    body: 'Manage theme, audio, notifications, graphics, privacy, and AGPL source links.',
  },
};

export function UtilityScreen({ view }: { view: UtilityView }) {
  const meta = viewMeta[view];
  const Icon = meta.icon;
  const { battle } = useArenaStore();

  return (
    <section className="utility-layout">
      <div className="utility-hero">
        <Icon size={30} aria-hidden />
        <span className="eyebrow">{meta.eyebrow}</span>
        <h1>{meta.title}</h1>
        <p>{meta.body}</p>
      </div>

      {view === 'teambuilder' ? (
        <div className="surface-panel team-builder-panel">
          <div className="panel-heading">
            <span>Current team</span>
            <strong>Gen 9 OU</strong>
          </div>
          <TeamBench team={battle.team} />
          <textarea aria-label="Team import text" placeholder="Paste a PS team export here" />
          <div className="button-row">
            <button type="button" className="primary-action">Validate</button>
            <button type="button" className="secondary-action">Import</button>
          </div>
        </div>
      ) : (
        <div className="surface-panel placeholder-panel">
          <KeyRound size={24} aria-hidden />
          <h2>Compatibility surface</h2>
          <p>This screen is scaffolded for the parity implementation while keeping legacy protocol behavior isolated.</p>
          <ul>
            <li>Typed route is active.</li>
            <li>Responsive app shell is shared.</li>
            <li>Vercel SPA fallback will load this direct URL.</li>
          </ul>
        </div>
      )}

      {view === 'rooms' && (
        <div className="surface-panel room-list-panel">
          <div className="panel-heading">
            <span>Rooms</span>
            <strong>Preview</strong>
          </div>
          {['Lobby', 'OverUsed', 'Tournaments', 'Help'].map(room => (
            <button className="room-list-row" type="button" key={room}>
              <MessageCircle size={16} aria-hidden />
              <span>{room}</span>
              <em>Join</em>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
