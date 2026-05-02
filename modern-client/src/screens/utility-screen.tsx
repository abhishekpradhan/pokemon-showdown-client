import {
  Bell,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Gauge,
  MessageCircle,
  Moon,
  RadioTower,
  Settings,
  Shield,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { TeamBench } from '../components/team-bench';
import { useArenaStore } from '../stores/arena-store';

type UtilityView = 'teambuilder' | 'rooms' | 'ladder' | 'replays' | 'settings';

type ViewMeta = {
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  body: string;
};

const viewMeta: Record<UtilityView, ViewMeta> = {
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
    body: 'Load, scrub, upload, and share battle logs while preserving replay compatibility.',
  },
  settings: {
    title: 'Settings',
    eyebrow: 'Client',
    icon: Settings,
    body: 'Manage theme, audio, notifications, graphics, privacy, and AGPL source links.',
  },
};

const roomRows = [
  { title: 'Lobby', meta: '1,284 users', status: 'Public chat' },
  { title: 'OverUsed', meta: 'Team discussion', status: 'Slow mode' },
  { title: 'Tournaments', meta: '3 active', status: 'Open signups' },
  { title: 'Help', meta: '42 users', status: 'Staff online' },
];

const ladderRows = [
  { rank: '01', name: 'storm-zone', rating: '1892', change: '+24' },
  { rank: '02', name: 'iron tempo', rating: '1868', change: '+11' },
  { rank: '03', name: 'hazard stack', rating: '1844', change: '-7' },
  { rank: '04', name: 'calm wincon', rating: '1816', change: '+18' },
];

const replayRows = [
  { title: 'Gen 9 OU - Iron Valiant endgame', meta: 'Turn 42', tag: 'Saved' },
  { title: 'Doubles OU - speed control pivot', meta: 'Turn 18', tag: 'Review' },
  { title: 'Random Battle - timer comeback', meta: 'Turn 33', tag: 'Shared' },
];

const settingRows = [
  { icon: Moon, title: 'Theme', meta: 'Dark arena' },
  { icon: Bell, title: 'Notifications', meta: 'Mentions and battles' },
  { icon: Gauge, title: 'Animations', meta: 'Battle motion on' },
  { icon: RadioTower, title: 'Server', meta: 'Direct PS protocol' },
];

export function UtilityScreen({ view }: { view: UtilityView }) {
  const meta = viewMeta[view];
  const Icon = meta.icon;
  const { battle } = useArenaStore();

  return (
    <section className="utility-layout" aria-label={meta.title}>
      <div className="utility-hero">
        <Icon size={30} aria-hidden />
        <span className="eyebrow">{meta.eyebrow}</span>
        <h1>{meta.title}</h1>
        <p>{meta.body}</p>
      </div>

      {view === 'teambuilder' && (
        <section className="surface-panel team-builder-panel" aria-label="Team import">
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
        </section>
      )}

      {view === 'rooms' && (
        <>
          <section className="surface-panel utility-panel" aria-label="Room activity">
            <div className="panel-heading">
              <span>Room activity</span>
              <strong>Live</strong>
            </div>
            <div className="chat-feed utility-chat">
              <p><strong>system</strong> Welcome to Lobby.</p>
              <p><strong>host</strong> Tournament signups open in 8 minutes.</p>
              <p><strong>spectator</strong> OU suspect discussion moved to OverUsed.</p>
            </div>
            <div className="chat-entry">
              <MessageCircle size={17} aria-hidden />
              <input aria-label="Room message" placeholder="Message room" />
              <button type="button" aria-label="Send room message"><ChevronRight size={16} /></button>
            </div>
          </section>
          <section className="surface-panel room-list-panel" aria-label="Room list">
            <div className="panel-heading">
              <span>Rooms</span>
              <strong>Preview</strong>
            </div>
            {roomRows.map(room => (
              <button className="room-list-row" type="button" key={room.title}>
                <MessageCircle size={16} aria-hidden />
                <span>
                  <strong>{room.title}</strong>
                  <small>{room.meta}</small>
                </span>
                <em>{room.status}</em>
              </button>
            ))}
          </section>
        </>
      )}

      {view === 'ladder' && (
        <>
          <section className="surface-panel utility-panel" aria-label="Ladder summary">
            <div className="panel-heading">
              <span>Selected format</span>
              <strong>Gen 9 OU</strong>
            </div>
            <dl className="stat-list utility-stats">
              <div>
                <dt>Your rating</dt>
                <dd>1516</dd>
              </div>
              <div>
                <dt>GXE</dt>
                <dd>73.4%</dd>
              </div>
              <div>
                <dt>Next decay</dt>
                <dd>6 days</dd>
              </div>
            </dl>
          </section>
          <section className="surface-panel utility-table-panel" aria-label="Ladder standings">
            <div className="panel-heading">
              <span>Top standings</span>
              <strong>Live preview</strong>
            </div>
            <div className="utility-table">
              {ladderRows.map(row => (
                <div className="utility-table-row" key={row.rank}>
                  <span>{row.rank}</span>
                  <strong>{row.name}</strong>
                  <em>{row.rating}</em>
                  <small>{row.change}</small>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {view === 'replays' && (
        <>
          <section className="surface-panel utility-panel" aria-label="Replay loader">
            <div className="panel-heading">
              <span>Replay loader</span>
              <strong>PS log</strong>
            </div>
            <textarea className="utility-textarea" aria-label="Replay log input" placeholder="Paste a replay log or URL" />
            <div className="button-row">
              <button type="button" className="primary-action">Load replay</button>
              <button type="button" className="secondary-action">Open file</button>
            </div>
          </section>
          <section className="surface-panel utility-table-panel" aria-label="Replay list">
            <div className="panel-heading">
              <span>Recent replays</span>
              <strong>3</strong>
            </div>
            {replayRows.map(row => (
              <button className="utility-list-row" type="button" key={row.title}>
                <BookOpen size={16} aria-hidden />
                <span>
                  <strong>{row.title}</strong>
                  <small>{row.meta}</small>
                </span>
                <em>{row.tag}</em>
              </button>
            ))}
          </section>
        </>
      )}

      {view === 'settings' && (
        <>
          <section className="surface-panel utility-panel" aria-label="Client settings">
            <div className="panel-heading">
              <span>Client defaults</span>
              <strong>Guest</strong>
            </div>
            {settingRows.map(row => {
              const RowIcon = row.icon;
              return (
                <button className="utility-list-row" type="button" key={row.title}>
                  <RowIcon size={16} aria-hidden />
                  <span>
                    <strong>{row.title}</strong>
                    <small>{row.meta}</small>
                  </span>
                  <em>Change</em>
                </button>
              );
            })}
          </section>
          <section className="surface-panel utility-panel" aria-label="Legal and source">
            <ClipboardCheck size={22} aria-hidden />
            <h2>AGPL source availability</h2>
            <p>Deployed copies must keep source access visible and preserve the fork license terms.</p>
            <div className="button-row">
              <a className="secondary-action" href="https://github.com/abhishekpradhan/pokemon-showdown-client">Source code</a>
              <a className="secondary-action" href="https://github.com/abhishekpradhan/pokemon-showdown-client/blob/main/LICENSE">License</a>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
