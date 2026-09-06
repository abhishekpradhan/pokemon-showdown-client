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
  UserRound,
  Wifi,
} from 'lucide-react';
import { FormatSelector } from '../components/format-selector';
import { SearchableSelect } from '../components/searchable-select';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';
import { battleSupport } from '../compat/battle-adapter';
import { openChallenge } from '../compat/ui-events';

export function HomeScreen() {
  const { activeTeamId, cancelSearch, challenges, focusRoom, joinRoom, rejectChallenge, refreshRoomList, roomList, connection, formats, lastError, named, searchFormats, searchState, selectTeam, selectedFormat, setSelectedFormat, startSearch, teams, username, validateTeamForFormat } = useArenaStore(
    useShallow(state => ({ activeTeamId: state.activeTeamId, cancelSearch: state.cancelSearch, challenges: state.challenges, focusRoom: state.focusRoom, joinRoom: state.joinRoom, rejectChallenge: state.rejectChallenge, refreshRoomList: state.refreshRoomList, roomList: state.roomList, connection: state.connection, formats: state.formats, lastError: state.lastError, named: state.named, searchFormats: state.searchFormats, searchState: state.searchState, selectTeam: state.selectTeam, selectedFormat: state.selectedFormat, setSelectedFormat: state.setSelectedFormat, startSearch: state.startSearch, teams: state.teams, username: state.username, validateTeamForFormat: state.validateTeamForFormat }))
  );
  const navigate = useNavigate();
  const [challengeTarget, setChallengeTarget] = useState('');
  const liveBattles = roomList.rooms.filter(room => room.id.startsWith('battle-') && battleSupport(room.format || room.id.split('-')[1]).supported).slice(0, 12);

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
    battleSupport(selectedFormat).reason || '',
    requiresTeam && !activeTeam ? 'Select a compatible team' : '',
    requiresTeam && activeTeam && !validation.ok ? validation.errors.join(' ') : '',
  ].filter(Boolean);
  const canSearch = blockers.filter(blocker => blocker !== 'Search in progress').length === 0;
  const needsTeam = requiresTeam && (!activeTeam || !validation.ok);
  const connecting = connection === 'connecting' || connection === 'reconnecting';
  const actionLabel = connection !== 'connected' ? connecting ? 'Connecting…' : 'Reconnect' : !named ? 'Choose name' : needsTeam ? activeTeam ? 'Edit team' : 'Build a team' : 'Find battle';
  const begin = (opener: HTMLElement) => {
    if (connection !== 'connected') { useArenaStore.getState().reconnect(); return; }
    if (!named) { window.dispatchEvent(new CustomEvent('arena:open-account', { detail: opener })); return; }
    if (needsTeam) { void navigate({ to: '/teambuilder' }); return; }
    startSearch();
  };
  const teamOptions = teams.filter(team => team.format === selectedFormat || !team.format).map(team => ({
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
      <section className={`match-stage is-${searchState}`}>
        <div className="match-stage-toolbar">
          <span className={`live-label is-${connection}`}>
            <Signal size={13} aria-hidden />
            {connection === 'connected' ? 'Battle server live' : `Server ${connection}`}
          </span>
        </div>

        <div className="match-stage-copy">
          <span className="eyebrow">Matchmaking</span>
          <h1>{searchState === 'searching' ? 'Looking for an opponent.' : 'Find a battle'}</h1>
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
              <FormatSelector value={selectedFormat} formats={formats.filter(format => format.searchShow && battleSupport(format.id).supported)} onValueChange={setSelectedFormat} />
            </label>
            <label className="control-field">
              <span>Battle team</span>
              {requiresTeam ? <SearchableSelect
                ariaLabel="Select active team"
                emptyLabel="No teams for this format. Create one in Teams."
                options={teamOptions}
                placeholder="Choose team"
                value={teamOptions.some(option => option.value === activeTeamId) ? activeTeamId : undefined}
                onValueChange={selectTeam}
              /> : <span className="provided-team"><Shield size={17} aria-hidden /><span><strong>Provided team</strong><small>Provided when the battle starts</small></span></span>}
            </label>
            <button className="queue-action" type="button" onClick={event => begin(event.currentTarget)} disabled={connecting || (connection === 'connected' && named && !needsTeam && !canSearch)}>
              <Radio size={17} aria-hidden />
              {actionLabel}
            </button>
          </div>
        ) : (
          <div className="searching-deck" key="searching" role="status" aria-live="polite">
            <span className="searching-radar" aria-hidden><i /><i /><i /></span>
            <span>
              <strong>Searching {selected?.name || selectedFormat}</strong>
              <small>You can browse while we find an opponent. Your battle opens when matched.</small>
            </span>
            <button className="queue-cancel" type="button" onClick={cancelSearch}>Cancel</button>
          </div>
        )}
      </section>

      <aside className="match-inspector" aria-label="Queue readiness">
        <div className="inspector-heading">
          <span>
            <small>Before you play</small>
            <strong>Your setup</strong>
          </span>
          <em>{searchState === 'searching' ? 'Searching' : canSearch ? 'Ready' : connection !== 'connected' ? connecting ? 'Connecting' : 'Offline' : !named ? 'Name needed' : needsTeam ? 'Team needed' : 'Check format'}</em>
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
        {searchState === 'idle' && selectedFormat !== 'gen9randombattle' && formats.some(format => format.id === 'gen9randombattle') && <button type="button" className="secondary-action random-battle-shortcut" onClick={() => setSelectedFormat('gen9randombattle')}>Try Random Battle <small>No team needed</small></button>}
        {challenges.to && <div className="queue-notice" role="status"><span>Challenge sent to {challenges.to.to} · {challenges.to.format}</span><button type="button" className="secondary-action" onClick={() => useArenaStore.getState().cancelChallenge()}>Cancel challenge</button></div>}

        {(lastError || (named && blockers.length > 0 && searchState === 'idle')) && (
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
            openChallenge(challengeTarget, selectedFormat);
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
        <p className="challenge-send-hint">Review the format and team before sending.</p>

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
                    <small>{challenges.details?.[challenger.toLowerCase().replace(/[^a-z0-9]/g, '')]?.message || format}</small>
                  </span>
                  <span className="challenge-actions">
                    <button type="button" className="primary-action" onClick={() => openChallenge(challenger, format, true)}>{challenges.details?.[challenger.toLowerCase().replace(/[^a-z0-9]/g, '')]?.acceptLabel || 'Accept'}</button>
                    <button type="button" className="secondary-action" onClick={() => rejectChallenge(challenger)}>{challenges.details?.[challenger.toLowerCase().replace(/[^a-z0-9]/g, '')]?.rejectLabel || 'Reject'}</button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}


      </aside>

      <section className="live-now" aria-label="Live battles">
        <div className="live-now-heading">
          <span>
            <small>Spectate</small>
            <h2>Live now</h2>
          </span>
          <Link to="/battles" className="stage-link">
            Browse battles <ArrowUpRight size={13} aria-hidden />
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
            <p className="pane-empty">{connection === 'connected' ? 'No live battles available in the latest server snapshot.' : 'Connect to browse battles.'}</p>
          )}
        </div>
      </section>
    </section>
  );
}
