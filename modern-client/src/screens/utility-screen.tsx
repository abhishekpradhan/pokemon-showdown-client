import {
  Bell,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Gauge,
  Copy,
  Pencil,
  MessageCircle,
  Moon,
  RadioTower,
  RefreshCw,
  Trash2,
  Settings,
  Shield,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/confirm-dialog';
import { SearchableSelect } from '../components/searchable-select';
import { StatusCallout } from '../components/status-callout';
import { TeamBench } from '../components/team-bench';
import { exportTeam, teamSummary } from '../compat/team-store';
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
    body: 'Import, save, select, and pack teams for PS-compatible searches.',
  },
  rooms: {
    title: 'Rooms',
    eyebrow: 'Community',
    icon: Users,
    body: 'Join live chat rooms, inspect public battles, and keep PMs in the same shell.',
  },
  ladder: {
    title: 'Ladder',
    eyebrow: 'Ranked',
    icon: Trophy,
    body: 'Fetch public ladder data when the endpoint is available for the selected format.',
  },
  replays: {
    title: 'Replays',
    eyebrow: 'Review',
    icon: BookOpen,
    body: 'Load replay URLs or pasted logs without mixing review tools into battle rooms.',
  },
  settings: {
    title: 'Settings',
    eyebrow: 'Client',
    icon: Settings,
    body: 'Manage connection diagnostics, protocol logging, source links, and local display defaults.',
  },
};

const settingRows = [
  { icon: Moon, title: 'Theme', meta: 'Dark arena active' },
  { icon: Bell, title: 'Notifications', meta: 'Mentions and battles tracked in-client' },
  { icon: Gauge, title: 'Motion', meta: 'Uses OS reduced-motion preference' },
];

export function UtilityScreen({ view }: { view: UtilityView }) {
  const meta = viewMeta[view];
  const Icon = meta.icon;
  const {
    activeTeam,
    activeTeamId,
    connection,
    connect,
    deleteTeam,
    disconnect,
    duplicateTeam,
    exportActiveTeam,
    formats,
    importTeamText,
    joinRoom,
    lastError,
    rawProtocolLog,
    reconnect,
    refreshRoomList,
    roomList,
    rooms,
    sendRoomMessage,
    server,
    selectTeam,
    renameTeam,
    replaceTeamFromText,
    updateTeamFormat,
    selectedFormat,
    teams,
    teamNotice,
    toggleProtocolLog,
    protocolLogEnabled,
  } = useArenaStore();
  const [roomMessage, setRoomMessage] = useState('');
  const [teamText, setTeamText] = useState(() => exportTeam(activeTeam));
  const [teamName, setTeamName] = useState('');
  const [teamFormat, setTeamFormat] = useState(selectedFormat);
  const [editingTeamId, setEditingTeamId] = useState<string | undefined>(activeTeamId);
  const [teamToDelete, setTeamToDelete] = useState<string | undefined>();
  const [replayInput, setReplayInput] = useState('');
  const [replayStatus, setReplayStatus] = useState('Paste a replay URL or log, then load it locally.');
  const [ladderStatus, setLadderStatus] = useState('Select refresh to fetch public ladder data for the active format.');
  const [ladderRows, setLadderRows] = useState<Array<{ rank: string; name: string; rating: string }>>([]);
  const liveRooms = Object.values(rooms);
  const lobby = rooms.lobby || liveRooms.find(room => room.type !== 'battle') || liveRooms[0];
  const activeStoredTeam = teams.find(team => team.id === activeTeamId);
  const editingTeam = teams.find(team => team.id === editingTeamId);
  const activeSummary = activeStoredTeam ? teamSummary(activeStoredTeam) : undefined;
  const teamOptions = teams.map(team => ({
    value: team.id,
    label: team.name,
    group: team.format,
    description: `${team.sets.length} Pokemon`,
    meta: team.id === activeTeamId ? 'Active' : 'Team',
  }));
  const formatOptions = formats.map(format => ({
    value: format.id,
    label: format.name,
    group: format.section || 'Formats',
    description: `${format.searchShow ? 'Searchable' : 'Not searchable'} · ${format.team === false ? 'Preset team' : 'Team required'}`,
    meta: format.team === false ? 'Preset' : 'Team',
  }));
  const roomRows = useMemo(() => {
    const joined = liveRooms.map(room => ({
      id: room.id,
      title: room.title,
      detail: room.users.length ? `${room.users.length} users` : room.type,
      status: room.connected ? 'Joined' : 'Rejoin',
    }));
    const publicRows = roomList.rooms.slice(0, 24).map(room => ({
      id: room.id,
      title: room.title,
      detail: room.p1 ? `${room.p1}${room.p2 ? ` vs ${room.p2}` : ''}` : `${room.users ?? 0} users`,
      status: room.p1 ? 'Watch' : 'Join',
    }));
    return [...joined, ...publicRows.filter(room => !joined.some(joinedRoom => joinedRoom.id === room.id))];
  }, [liveRooms, roomList.rooms]);

  useEffect(() => {
    if (view === 'rooms' && connection === 'connected') refreshRoomList();
  }, [connection, refreshRoomList, view]);

  const submitRoomMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendRoomMessage(lobby?.id || 'lobby', roomMessage);
    setRoomMessage('');
  };

  const importTeam = () => {
    importTeamText(teamText, teamName, teamFormat);
  };

  const editTeam = (teamId: string) => {
    const team = teams.find(entry => entry.id === teamId);
    if (!team) return;
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setTeamFormat(team.format);
    setTeamText(exportTeam(team.packed));
  };

  const saveTeamChanges = () => {
    if (!editingTeamId) {
      importTeamText(teamText, teamName);
      return;
    }
    if (teamName.trim()) renameTeam(editingTeamId, teamName);
    replaceTeamFromText(editingTeamId, teamText);
    updateTeamFormat(editingTeamId, teamFormat);
  };

  const refreshLadder = async () => {
    setLadderStatus('Fetching public ladder data...');
    try {
      const response = await fetch('https://pokemonshowdown.com/ladder/gen9ou.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { users?: Array<{ username: string; elo?: number; rpr?: number }> };
      const rows = (data.users || []).slice(0, 10).map((user, index) => ({
        rank: String(index + 1).padStart(2, '0'),
        name: user.username,
        rating: String(Math.round(user.elo || user.rpr || 0)),
      }));
      setLadderRows(rows);
      setLadderStatus(rows.length ? 'Public ladder data loaded.' : 'The ladder endpoint returned no rows.');
    } catch (error) {
      setLadderRows([]);
      setLadderStatus(error instanceof Error ? `Ladder unavailable: ${error.message}` : 'Ladder unavailable.');
    }
  };

  const loadReplay = async () => {
    const value = replayInput.trim();
    if (!value) {
      setReplayStatus('Paste a replay URL or log first.');
      return;
    }
    if (value.startsWith('http')) {
      try {
        const response = await fetch(value.endsWith('.log') ? value : `${value}.log`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        setReplayInput(text);
        setReplayStatus(`Loaded ${text.split('\n').length} replay log lines.`);
      } catch (error) {
        setReplayStatus(error instanceof Error ? `Replay unavailable: ${error.message}` : 'Replay unavailable.');
      }
      return;
    }
    setReplayStatus(`Loaded ${value.split('\n').length} pasted replay log lines.`);
  };

  return (
    <section className="utility-layout" aria-label={meta.title}>
      <div className="utility-hero">
        <Icon size={30} aria-hidden />
        <span className="eyebrow">{meta.eyebrow}</span>
        <h1>{meta.title}</h1>
        <p>{meta.body}</p>
      </div>

      {view === 'teambuilder' && (
        <>
          <section className="surface-panel team-builder-panel" aria-label="Team import">
            <div className="panel-heading">
              <span>Active team</span>
              <strong>{activeStoredTeam?.name || 'Unsaved import'}</strong>
            </div>
            {activeSummary && <TeamBench team={activeSummary.pokemon} />}
            <SearchableSelect
              ariaLabel="Select active team"
              emptyLabel="No saved teams"
              options={teamOptions}
              placeholder="Choose team"
              value={activeTeamId}
              onValueChange={teamId => {
                selectTeam(teamId);
                editTeam(teamId);
              }}
            />
            <SearchableSelect
              ariaLabel="Set team format"
              emptyLabel="No formats match"
              options={formatOptions}
              placeholder="Team format"
              value={teamFormat}
              onValueChange={setTeamFormat}
            />
            <input
              className="utility-input"
              aria-label="Team name"
              placeholder="Team name"
              value={teamName}
              onChange={event => setTeamName(event.currentTarget.value)}
            />
            <textarea
              aria-label="Team import text"
              placeholder="Paste a PS team export or packed team here"
              value={teamText}
              onChange={event => setTeamText(event.currentTarget.value)}
            />
            <div className="button-row">
              <button type="button" className="primary-action" onClick={editingTeamId ? saveTeamChanges : importTeam}>
                {editingTeamId ? 'Save changes' : 'Import and save'}
              </button>
              <button type="button" className="secondary-action" onClick={() => {
                setEditingTeamId(undefined);
                setTeamName('');
                setTeamText('');
              }}>New team</button>
              <button type="button" className="secondary-action" onClick={() => setTeamText(exportActiveTeam())}>Export active</button>
            </div>
            {editingTeam && <StatusCallout>Editing {editingTeam.name}</StatusCallout>}
            {teamNotice && <StatusCallout tone="success">{teamNotice}</StatusCallout>}
            {lastError && <StatusCallout tone="error">{lastError}</StatusCallout>}
          </section>
          <section className="surface-panel utility-table-panel" aria-label="Saved teams">
            <div className="panel-heading">
              <span>Saved teams</span>
              <strong>{teams.length}</strong>
            </div>
            {teams.length ? teams.map(team => (
              <div className="utility-list-row team-row" key={team.id}>
                <Shield size={16} aria-hidden />
                <span>
                  <strong>{team.name}</strong>
                  <small>{team.format} · {team.sets.length} Pokemon</small>
                </span>
                <em>{team.id === activeTeamId ? 'Active' : 'Select'}</em>
                <div className="row-actions">
                  <button type="button" className="secondary-action compact-action" onClick={() => {
                    selectTeam(team.id);
                    editTeam(team.id);
                  }}>Select</button>
                  <button type="button" className="icon-button light-icon" aria-label={`Edit ${team.name}`} onClick={() => editTeam(team.id)}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className="icon-button light-icon" aria-label={`Duplicate ${team.name}`} onClick={() => duplicateTeam(team.id)}>
                    <Copy size={15} />
                  </button>
                  <ConfirmDialog
                    open={teamToDelete === team.id}
                    setOpen={open => setTeamToDelete(open ? team.id : undefined)}
                    title={`Delete ${team.name}?`}
                    description="This removes the team from local browser storage."
                    confirmLabel="Delete team"
                    onConfirm={() => deleteTeam(team.id)}
                  >
                    <button type="button" className="icon-button light-icon danger-icon" aria-label={`Delete ${team.name}`} onClick={() => setTeamToDelete(team.id)}>
                      <Trash2 size={15} />
                    </button>
                  </ConfirmDialog>
                </div>
              </div>
            )) : <StatusCallout tone="error">No saved teams. Import a team to search team formats.</StatusCallout>}
          </section>
        </>
      )}

      {view === 'rooms' && (
        <>
          <section className="surface-panel utility-panel" aria-label="Room activity">
            <div className="panel-heading">
              <span>Room activity</span>
              <strong>{lobby?.title || connection}</strong>
            </div>
            <div className="chat-feed utility-chat">
              {(lobby?.chat.length ? lobby.chat.slice(-12) : [
                { user: 'system', message: connection === 'connected' ? 'Join a room to receive live messages.' : 'Connect to the server to receive live room messages.' },
              ]).map((message, index) => (
                <p key={`${message.user}-${message.message}-${index}`}><strong>{message.user}</strong> {message.message}</p>
              ))}
            </div>
            <form className="chat-entry" onSubmit={submitRoomMessage}>
              <MessageCircle size={17} aria-hidden />
              <input
                aria-label="Room message"
                placeholder={`Message ${lobby?.title || 'room'}`}
                value={roomMessage}
                onChange={event => setRoomMessage(event.currentTarget.value)}
              />
              <button type="submit" aria-label="Send room message"><ChevronRight size={16} /></button>
            </form>
          </section>
          <section className="surface-panel room-list-panel" aria-label="Room list">
            <div className="panel-heading">
              <span>Rooms</span>
              <button type="button" className="secondary-action compact-action" onClick={() => refreshRoomList()}>
                <RefreshCw size={15} aria-hidden /> Refresh
              </button>
            </div>
            {roomRows.length ? roomRows.map(room => (
              <button className="room-list-row" type="button" key={room.id} onClick={() => joinRoom(room.id)}>
                <MessageCircle size={16} aria-hidden />
                <span>
                  <strong>{room.title}</strong>
                  <small>{room.detail}</small>
                </span>
                <em>{room.status}</em>
              </button>
            )) : <p className="inline-status">No rooms loaded yet.</p>}
          </section>
        </>
      )}

      {view === 'ladder' && (
        <>
          <section className="surface-panel utility-panel" aria-label="Ladder summary">
            <div className="panel-heading">
              <span>Public ladder</span>
              <button type="button" className="secondary-action compact-action" onClick={refreshLadder}>
                <RefreshCw size={15} aria-hidden /> Refresh
              </button>
            </div>
            <p>{ladderStatus}</p>
          </section>
          <section className="surface-panel utility-table-panel" aria-label="Ladder standings">
            <div className="panel-heading">
              <span>Top standings</span>
              <strong>{ladderRows.length || '-'}</strong>
            </div>
            <div className="utility-table">
              {ladderRows.map(row => (
                <div className="utility-table-row" key={row.rank}>
                  <span>{row.rank}</span>
                  <strong>{row.name}</strong>
                  <em>{row.rating}</em>
                  <small>elo</small>
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
            <textarea
              className="utility-textarea"
              aria-label="Replay log input"
              placeholder="Paste a replay log or replay URL"
              value={replayInput}
              onChange={event => setReplayInput(event.currentTarget.value)}
            />
            <div className="button-row">
              <button type="button" className="primary-action" onClick={loadReplay}>Load replay</button>
            </div>
            <p>{replayStatus}</p>
          </section>
          <section className="surface-panel utility-table-panel" aria-label="Replay state">
            <div className="panel-heading">
              <span>Loaded log</span>
              <strong>{replayInput ? `${replayInput.split('\n').length} lines` : '-'}</strong>
            </div>
            <pre className="protocol-log">{replayInput.slice(0, 1200) || 'No replay loaded.'}</pre>
          </section>
        </>
      )}

      {view === 'settings' && (
        <>
          <section className="surface-panel utility-panel" aria-label="Client settings">
            <div className="panel-heading">
              <span>Server connection</span>
              <strong>{connection}</strong>
            </div>
            <button className="utility-list-row" type="button" onClick={() => connection === 'connected' ? disconnect() : connect()}>
              <RadioTower size={16} aria-hidden />
              <span>
                <strong>{server.id}</strong>
                <small>{server.host}:{server.port}{server.prefix}</small>
              </span>
              <em>{connection === 'connected' ? 'Disconnect' : 'Connect'}</em>
            </button>
            <button className="utility-list-row" type="button" onClick={reconnect}>
              <RefreshCw size={16} aria-hidden />
              <span>
                <strong>Reconnect</strong>
                <small>Reconnect and rejoin tracked rooms</small>
              </span>
              <em>Run</em>
            </button>
            {settingRows.map(row => {
              const RowIcon = row.icon;
              return (
                <div className="utility-list-row" key={row.title}>
                  <RowIcon size={16} aria-hidden />
                  <span>
                    <strong>{row.title}</strong>
                    <small>{row.meta}</small>
                  </span>
                  <em>Status</em>
                </div>
              );
            })}
            <label className="switch-row light-switch-row">
              <span>Protocol log</span>
              <input
                type="checkbox"
                checked={protocolLogEnabled}
                onChange={event => toggleProtocolLog(event.currentTarget.checked)}
              />
            </label>
            {lastError && <p className="inline-error">{lastError}</p>}
          </section>
          <section className="surface-panel utility-panel" aria-label="Legal and source">
            <ClipboardCheck size={22} aria-hidden />
            <h2>AGPL source availability</h2>
            <p>Deployed copies must keep source access visible and preserve the fork license terms.</p>
            <div className="button-row">
              <a className="secondary-action" href="https://github.com/abhishekpradhan/pokemon-showdown-client">Source code</a>
              <a className="secondary-action" href="https://github.com/abhishekpradhan/pokemon-showdown-client/blob/main/LICENSE">License</a>
            </div>
            {protocolLogEnabled && (
              <pre className="protocol-log" aria-label="Protocol log">
                {rawProtocolLog.slice(0, 12).join('\n') || 'No protocol messages yet.'}
              </pre>
            )}
          </section>
        </>
      )}
    </section>
  );
}
