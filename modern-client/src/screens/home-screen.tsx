import { Link } from '@tanstack/react-router';
import * as Tabs from '@radix-ui/react-tabs';
import { motion } from 'motion/react';
import { Swords, Timer, UsersRound } from 'lucide-react';
import { FormatSelector } from '../components/format-selector';
import { MiniRoomRail } from '../components/mini-room-rail';
import { useArenaStore } from '../stores/arena-store';

export function HomeScreen() {
  const { selectedFormat, setSelectedFormat, searchState, startSearch, cancelSearch } = useArenaStore();

  return (
    <section className="home-grid" aria-label="Matchmaking">
      <div className="hero-arena">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}
        >
          <span className="eyebrow">PS-compatible fork</span>
          <h1>Showdown Arena</h1>
          <p>Competitive battles, modern controls, and the familiar team-building rhythm.</p>
        </motion.div>
        <div className="hero-actions" aria-label="Battle search">
          <FormatSelector value={selectedFormat} onValueChange={setSelectedFormat} />
          {searchState === 'idle' ? (
            <button className="primary-action" type="button" onClick={startSearch}>
              <Swords size={19} aria-hidden />
              Battle
            </button>
          ) : (
            <button className="danger-action" type="button" onClick={cancelSearch}>
              <Timer size={19} aria-hidden />
              Cancel search
            </button>
          )}
          <Link to="/battle/$battleId" params={{ battleId: 'demo-gen9ou' }} className="secondary-action">
            Open demo battle
          </Link>
        </div>
      </div>

      <div className="surface-panel match-panel">
        <div className="panel-heading">
          <span>Queue</span>
          <strong>{searchState === 'idle' ? 'Ready' : 'Searching'}</strong>
        </div>
        <div className="queue-meter" data-state={searchState}>
          <span />
        </div>
        <dl className="stat-list">
          <div>
            <dt>Format</dt>
            <dd>{selectedFormat}</dd>
          </div>
          <div>
            <dt>Privacy</dt>
            <dd>Open spectators</dd>
          </div>
          <div>
            <dt>Server</dt>
            <dd>Direct PS protocol</dd>
          </div>
        </dl>
      </div>

      <Tabs.Root className="surface-panel activity-panel" defaultValue="rooms">
        <Tabs.List className="segmented-tabs" aria-label="Activity">
          <Tabs.Trigger value="rooms">
            <UsersRound size={15} aria-hidden /> Rooms
          </Tabs.Trigger>
          <Tabs.Trigger value="battles">
            <Swords size={15} aria-hidden /> Battles
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="rooms">
          <MiniRoomRail mode="rooms" />
        </Tabs.Content>
        <Tabs.Content value="battles">
          <MiniRoomRail mode="battles" />
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}
