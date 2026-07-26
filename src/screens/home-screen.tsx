import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Radio,
  Shield,
  Signal,
  Swords,
  Timer,
  UserRound,
  Wifi,
} from 'lucide-react';
import { FormatSelector } from '../components/format-selector';
import { SearchableSelect } from '../components/searchable-select';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';

export function HomeScreen() {
  const { acceptChallenge, activeTeamId, cancelSearch, challenges, focusRoom, joinRoom, rejectChallenge, refreshRoomList, roomList, sendChallenge, connection, formats, lastError, named, searchFormats, searchState, selectTeam, selectedFormat, setSelectedFormat, startSearch, teams, username, validateTeamForFormat } = useArenaStore(
    useShallow(state => ({ acceptChallenge: state.acceptChallenge, activeTeamId: state.activeTeamId, cancelSearch: state.cancelSearch, challenges: state.challenges, focusRoom: state.focusRoom, joinRoom: state.joinRoom, rejectChallenge: state.rejectChallenge, refreshRoomList: state.refreshRoomList, roomList: state.roomList, sendChallenge: state.sendChallenge, connection: state.connection, formats: state.formats, lastError: state.lastError, named: state.named, searchFormats: state.searchFormats, searchState: state.searchState, selectTeam: state.selectTeam, selectedFormat: state.selectedFormat, setSelectedFormat: state.setSelectedFormat, startSearch: state.startSearch, teams: state.teams, username: state.username, validateTeamForFormat: state.validateTeamForFormat }))
  );
  const navigate = useNavigate();
  const [challengeTarget, setChallengeTarget] = useState('');
  const liveBattles = roomList.rooms.slice(0, 12);

  useEffect(() => {
    if (connection === 'connected') refreshRoomList();
  }, [connection, refreshRoomList]);

  const watchBattle = (roomId: string) => {
    joinRoom(roomId);
    focusRoom(roomId);
    void navigate({ to: '/battle/$battleId', params: { battleId: roomId } });
  };
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
      <div className="match-main">
        <section className={`match-stage is-${searchState}`}>
          <div className="match-stage-toolbar">
            <span className={`live-label is-${connection}`}>
              <Signal size={13} aria-hidden />
              {connection === 'connected' ? 'Battle server live' : `Server ${connection}`}
            </span>
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

          {searchState === 'idle' ? (
            <div className="queue-controls" key="setup">
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
                <Radio size={17} aria-hidden />
                Find battle
              </button>
            </div>
          ) : (
            <div className="searching-deck" key="searching" role="status" aria-live="polite">
              <span className="searching-radar" aria-hidden><i /><i /><i /></span>
              <span>
                <strong>Searching {selected?.name || selectedFormat}</strong>
                <small>Keep this workspace open. The battle will take focus when matched.</small>
              </span>
              <button className="queue-cancel" type="button" onClick={cancelSearch}>Cancel</button>
            </div>
          )}
        </section>

        <section className="live-now" aria-label="Live battles">
          <div className="live-now-heading">
            <span>
              <small>Spectate</small>
              <h2>Live now</h2>
            </span>
            <Link to="/rooms" className="stage-link">
              Browse rooms <ArrowUpRight size={13} aria-hidden />
            </Link>
          </div>
          <div className="live-grid">
            {liveBattles.map(room => (
              <button type="button" className="live-card" key={room.id} onClick={() => watchBattle(room.id)}>
                <small>{room.format || room.id.replace(/^battle-/, '').replace(/-\d+$/, '')}</small>
                <strong>{room.p1 ? `${room.p1} vs ${room.p2 || '?'}` : room.title}</strong>
                <span className="live-card-action"><Swords size={13} aria-hidden /> Watch</span>
              </button>
            ))}
            {!liveBattles.length && (
              <p className="pane-empty">{connection === 'connected' ? 'Loading live battles…' : 'Connect to browse battles.'}</p>
            )}
          </div>
        </section>
      </div>

      <aside className="match-inspector" aria-label="Queue readiness">
        <div className="inspector-heading">
          <span>
            <small>Session</small>
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
          <span>Challenge a player</span>
        </div>
        <form
          className="challenge-send"
          onSubmit={event => {
            event.preventDefault();
            if (!challengeTarget.trim()) return;
            sendChallenge(challengeTarget);
            setChallengeTarget('');
          }}
        >
          <input
            aria-label="Player to challenge"
            placeholder="Username"
            value={challengeTarget}
            onChange={event => setChallengeTarget(event.currentTarget.value)}
          />
          <button type="submit" className="secondary-action" disabled={!challengeTarget.trim()}>
            Challenge
          </button>
        </form>
        <p className="challenge-send-hint">Uses the selected format and team above.</p>

        {Object.keys(challenges.from).length > 0 && (
          <>
            <div className="inspector-section-heading">
              <span>Incoming challenges</span>
            </div>
            <div className="challenge-list">
              {Object.entries(challenges.from).map(([challenger, format]) => (
                <div className="challenge-row" key={challenger}>
                  <span>
                    <strong>{challenger}</strong>
                    <small>{format}</small>
                  </span>
                  <span className="challenge-actions">
                    <button type="button" className="primary-action" onClick={() => acceptChallenge(challenger)}>Accept</button>
                    <button type="button" className="secondary-action" onClick={() => rejectChallenge(challenger)}>Reject</button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}


        <div className="match-inspector-footer">
          <Timer size={14} aria-hidden />
          <span>Battle decisions remain available in the bottom action deck.</span>
        </div>
      </aside>
    </section>
  );
}
