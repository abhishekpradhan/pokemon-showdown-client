import { Link } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Radio,
  Shield,
  Signal,
  Timer,
  UserRound,
  Wifi,
} from 'lucide-react';
import { FormatSelector } from '../components/format-selector';
import { MiniRoomRail } from '../components/mini-room-rail';
import { SearchableSelect } from '../components/searchable-select';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';

export function HomeScreen() {
  const { activeTeamId, cancelSearch, connection, formats, lastError, named, searchFormats, searchState, selectTeam, selectedFormat, setSelectedFormat, startSearch, teams, username, validateTeamForFormat } = useArenaStore(
    useShallow(state => ({ activeTeamId: state.activeTeamId, cancelSearch: state.cancelSearch, connection: state.connection, formats: state.formats, lastError: state.lastError, named: state.named, searchFormats: state.searchFormats, searchState: state.searchState, selectTeam: state.selectTeam, selectedFormat: state.selectedFormat, setSelectedFormat: state.setSelectedFormat, startSearch: state.startSearch, teams: state.teams, username: state.username, validateTeamForFormat: state.validateTeamForFormat }))
  );
  const selected = formats.find(format => format.id === selectedFormat);
  const activeTeam = teams.find(team => team.id === activeTeamId);
  const requiresTeam = selected?.team !== false;
  const validation = validateTeamForFormat(activeTeamId, selectedFormat);
  const blockers = [
    connection !== 'connected' ? 'Connect to the battle server' : '',
    !named ? 'Choose a player name' : '',
    searchState === 'searching' ? 'Search in progress' : '',
    !selected?.searchShow ? 'Choose a searchable format' : '',
    requiresTeam && !activeTeam ? 'Select a compatible team' : '',
    requiresTeam && activeTeam && !validation.ok ? validation.errors.join(' ') : '',
  ].filter(Boolean);
  const canSearch = blockers.filter(blocker => blocker !== 'Search in progress').length === 0;
  const teamOptions = teams.map(team => ({
    value: team.id,
    label: team.name,
    group: team.format,
    description: `${team.sets.length} Pokémon`,
    meta: team.id === activeTeamId ? 'Active' : 'Team',
  }));
  const readiness = [
    {
      label: 'Server',
      value: connection === 'connected' ? 'Online' : connection,
      ready: connection === 'connected',
      icon: Wifi,
    },
    {
      label: 'Identity',
      value: named ? username : 'Name required',
      ready: named,
      icon: UserRound,
    },
    {
      label: 'Team',
      value: requiresTeam ? activeTeam?.name || 'Team required' : 'Provided by format',
      ready: !requiresTeam || (!!activeTeam && validation.ok),
      icon: Shield,
    },
  ];

  return (
    <section className="match-workspace" aria-label="Matchmaking">
      <motion.section
        className={`match-stage is-${searchState}`}
        initial={{ opacity: 0, scale: 0.992 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <div className="match-stage-toolbar">
          <span className={`live-label is-${connection}`}>
            <Signal size={13} aria-hidden />
            {connection === 'connected' ? 'Battle server live' : `Server ${connection}`}
          </span>
          <Link to="/rooms" className="stage-link">
            Browse public rooms <ArrowUpRight size={13} aria-hidden />
          </Link>
        </div>

        <div className="match-stage-copy">
          <span className="eyebrow">Matchmaking</span>
          <h1>{searchState === 'searching' ? 'Looking for an opponent.' : 'Ready when you are.'}</h1>
          <p>
            {searchState === 'searching' ?
              `${formats.find(format => format.id === searchFormats[0])?.name || selected?.name || 'Selected format'} is in the queue.` :
              'Choose the ruleset and team for your next battle.'}
          </p>
        </div>

        <div className="match-control-deck">
          <AnimatePresence mode="wait" initial={false}>
            {searchState === 'idle' ? (
              <motion.div
                className="match-control-grid"
                key="setup"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <label className="control-field">
                  <span>Format</span>
                  <FormatSelector value={selectedFormat} formats={formats} onValueChange={setSelectedFormat} />
                </label>
                <label className="control-field">
                  <span>Battle team</span>
                  <SearchableSelect
                    ariaLabel="Select active team"
                    emptyLabel="No saved teams"
                    options={teamOptions}
                    placeholder={requiresTeam ? 'Choose team' : 'Preset team'}
                    value={activeTeamId}
                    onValueChange={selectTeam}
                  />
                </label>
                <button className="queue-action" type="button" onClick={startSearch} disabled={!canSearch}>
                  <Radio size={18} aria-hidden />
                  Find battle
                </button>
              </motion.div>
            ) : (
              <motion.div
                className="searching-deck"
                key="searching"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                role="status"
                aria-live="polite"
              >
                <span className="searching-radar" aria-hidden><i /><i /><i /></span>
                <span>
                  <strong>Searching {selected?.name || selectedFormat}</strong>
                  <small>Keep this workspace open. The battle will take focus when matched.</small>
                </span>
                <button className="queue-cancel" type="button" onClick={cancelSearch}>Cancel</button>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="queue-line" data-state={searchState}><span /></div>
        </div>
      </motion.section>

      <aside className="match-inspector" aria-label="Queue readiness">
        <div className="inspector-heading">
          <span>
            <small>Preflight</small>
            <strong>Queue readiness</strong>
          </span>
          <em>{canSearch ? 'Ready' : `${blockers.length} blocked`}</em>
        </div>

        <div className="readiness-list">
          {readiness.map(item => {
            const Icon = item.icon;
            return (
              <div className="readiness-row" key={item.label}>
                <span className={item.ready ? 'is-ready' : 'is-blocked'}>
                  <Icon size={15} aria-hidden />
                </span>
                <span>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                </span>
                {item.ready ?
                  <Check className="readiness-state is-ready" size={14} aria-label="Ready" /> :
                  <CircleAlert className="readiness-state is-blocked" size={14} aria-label="Blocked" />}
              </div>
            );
          })}
        </div>

        {(lastError || (blockers.length > 0 && searchState === 'idle')) && (
          <div className="queue-notice" role="status" aria-live="polite">
            <CircleAlert size={15} aria-hidden />
            <span>{lastError || blockers[0]}</span>
          </div>
        )}

        <div className="inspector-section-heading">
          <span>Open activity</span>
          <Link to="/rooms">View all</Link>
        </div>
        <MiniRoomRail mode="battles" />

        <div className="match-inspector-footer">
          <Timer size={14} aria-hidden />
          <span>Battle decisions remain available in the bottom action deck.</span>
        </div>
      </aside>
    </section>
  );
}
