import { Link } from '@tanstack/react-router';
import * as Tabs from '@radix-ui/react-tabs';
import { motion } from 'motion/react';
import { Shield, Swords, Timer, UsersRound } from 'lucide-react';
import { FormatSelector } from '../components/format-selector';
import { MiniRoomRail } from '../components/mini-room-rail';
import { useArenaStore } from '../stores/arena-store';

export function HomeScreen() {
  const { selectedFormat, formats, setSelectedFormat, searchState, searchFormats, startSearch, cancelSearch, connection, teams, activeTeamId, lastError, named } = useArenaStore();
  const selected = formats.find(format => format.id === selectedFormat);
  const activeTeam = teams.find(team => team.id === activeTeamId);
  const requiresTeam = selected?.team !== false;
  const blockers = [
    connection !== 'connected' ? 'Connect to the server' : '',
    !named ? 'Choose a name' : '',
    !selected?.searchShow ? 'Pick a searchable format' : '',
    requiresTeam && !activeTeam ? 'Select a team' : '',
  ].filter(Boolean);
  const canSearch = blockers.length === 0;
  const queueStatus = searchState === 'searching' ? `Searching ${searchFormats.join(', ') || selectedFormat}` :
    canSearch ? 'Ready to search' : blockers[0];

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
          <p>Connect to Showdown, pick a team, and queue without leaving the battle workspace.</p>
        </motion.div>
        <div className="hero-actions" aria-label="Battle search">
          <FormatSelector value={selectedFormat} formats={formats} onValueChange={setSelectedFormat} />
          <Link to="/teambuilder" className="secondary-action">
            <Shield size={19} aria-hidden />
            {activeTeam ? activeTeam.name : 'Choose team'}
          </Link>
          {searchState === 'idle' ? (
            <button className="primary-action" type="button" onClick={startSearch} disabled={!canSearch}>
              <Timer size={19} aria-hidden />
              Search battle
            </button>
          ) : (
            <button className="danger-action" type="button" onClick={cancelSearch}>
              <Timer size={19} aria-hidden />
              Cancel search
            </button>
          )}
        </div>
      </div>

      <div className="surface-panel match-panel">
        <div className="panel-heading">
          <span>Queue</span>
          <strong>{searchState === 'idle' ? queueStatus : 'Searching'}</strong>
        </div>
        <div className="queue-meter" data-state={searchState}>
          <span />
        </div>
        <dl className="stat-list">
          <div>
            <dt>Format</dt>
            <dd>{selected?.name || selectedFormat}</dd>
          </div>
          <div>
            <dt>Privacy</dt>
            <dd>{named ? 'Named' : 'Guest'}</dd>
          </div>
          <div>
            <dt>Server</dt>
            <dd>{connection}</dd>
          </div>
          <div>
            <dt>Team</dt>
            <dd>{requiresTeam ? activeTeam?.name || 'Required' : 'Preset'}</dd>
          </div>
        </dl>
        {lastError && <p className="inline-error">{lastError}</p>}
        <p className={canSearch ? 'inline-status' : 'inline-error'}>{queueStatus}</p>
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
