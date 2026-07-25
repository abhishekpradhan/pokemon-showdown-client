import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BattleField } from '../components/battle-field';
import { applyBattleProtocolLine, emptyBattle, type ArenaBattle } from '../compat/battle-adapter';

type ReplayLine = {
  raw: string;
  command: string;
  args: string[];
  label: string;
};

const parseReplayLine = (raw: string): ReplayLine => {
  const parts = raw.startsWith('|') ? raw.split('|') : ['', '', raw];
  const command = parts[1] || '';
  const args = parts.slice(2);
  let label = '';
  switch (command) {
  case 'turn': label = `Turn ${args[0]}`; break;
  case 'move': label = `${args[0]} used ${args[1]}.`; break;
  case 'switch':
  case 'drag': label = `${args[0]} entered the battle.`; break;
  case '-damage': label = `${args[0]} is at ${args[1]}.`; break;
  case '-heal': label = `${args[0]} recovered to ${args[1]}.`; break;
  case 'faint': label = `${args[0]} fainted.`; break;
  case 'win': label = `${args[0]} won the battle.`; break;
  case 'tie': label = 'The battle ended in a tie.'; break;
  case '-weather': label = args[0] === 'none' ? 'The weather cleared.' : `${args[0]} began.`; break;
  default: label = '';
  }
  return { raw, command, args, label };
};

const projectReplay = (lines: ReplayLine[], cursor: number): ArenaBattle => {
  let battle: ArenaBattle = {
    ...emptyBattle,
    id: 'replay',
    format: 'Replay',
    playerSide: 'p1',
    team: [],
    opponentTeam: [],
    log: [],
    chat: [],
    waiting: false,
    mode: 'spectator',
  };
  for (const line of lines.slice(0, cursor + 1)) {
    if (line.command === 'tier') battle = { ...battle, format: line.args[0] || battle.format };
    if (line.command === 'player') {
      const side = line.args[0];
      const name = line.args[1] || 'Player';
      battle = side === 'p2' ? { ...battle, p2: { ...battle.p2, name } } : { ...battle, p1: { ...battle.p1, name } };
    }
    if (line.command === 'turn') battle = { ...battle, turn: Number(line.args[0]) || battle.turn };
    battle = applyBattleProtocolLine(battle, line);
    if (line.label) battle = { ...battle, log: [line.label, ...battle.log].slice(0, 40) };
  }
  return battle;
};

export function ReplaysScreen() {
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<ReplayLine[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Paste a replay URL or battle log.');
  const battle = useMemo(() => projectReplay(lines, cursor), [cursor, lines]);
  const meaningfulEvents = useMemo(() => lines
    .map((line, index) => ({ ...line, index }))
    .filter(line => line.label), [lines]);

  useEffect(() => {
    if (!playing || !lines.length) return;
    const timer = window.setInterval(() => {
      setCursor(current => {
        if (current >= lines.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [lines.length, playing]);

  const loadReplay = async () => {
    const value = input.trim();
    if (!value) {
      setStatus('Paste a replay URL or battle log first.');
      return;
    }
    setLoading(true);
    try {
      let log = value;
      if (/^https?:\/\//.test(value)) {
        const replayUrl = value
          .replace(/\/$/, '')
          .replace(/\.json$/, '')
          .replace(/\.log$/, '');
        const response = await fetch(`${replayUrl}.log`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        log = await response.text();
        setInput(log);
      }
      const parsed = log.split(/\r?\n/).filter(Boolean).map(parseReplayLine);
      if (!parsed.some(line => line.command)) throw new Error('No battle protocol lines found.');
      setLines(parsed);
      setCursor(0);
      setPlaying(false);
      setStatus(`${parsed.length} protocol lines loaded.`);
    } catch (error) {
      setLines([]);
      setStatus(error instanceof Error ? `Replay unavailable: ${error.message}` : 'Replay unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const seek = (next: number) => {
    setCursor(Math.max(0, Math.min(lines.length - 1, next)));
  };

  return (
    <section className="utility-workspace replay-workspace" aria-label="Replays">
      <main className="workspace-stage replay-stage">
        <header className="stage-heading replay-heading">
          <span>
            <small>Battle review</small>
            <h1>Replays</h1>
          </span>
          <span className="replay-status" role="status">{status}</span>
        </header>

        <div className="replay-canvas">
          <BattleField battle={battle} />
          {!lines.length && (
            <div className="replay-empty">
              <Play size={24} aria-hidden />
              <strong>Load a battle to start reviewing.</strong>
            </div>
          )}
        </div>

        <div className="replay-transport" aria-label="Replay controls">
          <button type="button" aria-label="Restart replay" disabled={!lines.length} onClick={() => {
            setPlaying(false);
            seek(0);
          }}><RotateCcw size={15} /></button>
          <button type="button" aria-label="Previous event" disabled={!lines.length || cursor <= 0} onClick={() => seek(cursor - 1)}><ChevronLeft size={16} /></button>
          <button type="button" className="transport-play" aria-label={playing ? 'Pause replay' : 'Play replay'} disabled={!lines.length} onClick={() => setPlaying(value => !value)}>
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button type="button" aria-label="Next event" disabled={!lines.length || cursor >= lines.length - 1} onClick={() => seek(cursor + 1)}><ChevronRight size={16} /></button>
          <input
            type="range"
            aria-label="Replay timeline"
            min={0}
            max={Math.max(0, lines.length - 1)}
            value={Math.min(cursor, Math.max(0, lines.length - 1))}
            disabled={!lines.length}
            onChange={event => seek(Number(event.currentTarget.value))}
          />
          <span>{lines.length ? `${cursor + 1} / ${lines.length}` : '0 / 0'}</span>
        </div>
      </main>

      <aside className="workspace-inspector replay-inspector">
        <div className="replay-loader">
          <header className="inspector-heading">
            <span>
              <small>Source</small>
              <strong>Replay loader</strong>
            </span>
            <Download size={16} aria-hidden />
          </header>
          <textarea
            aria-label="Replay log input"
            placeholder="Paste a replay URL or protocol log"
            value={input}
            onChange={event => setInput(event.currentTarget.value)}
          />
          <button type="button" className="primary-action" disabled={loading} onClick={loadReplay}>
            {loading ? 'Loading…' : 'Load replay'}
          </button>
        </div>
        <div className="replay-event-heading">
          <span>Event timeline</span>
          <strong>{meaningfulEvents.length}</strong>
        </div>
        <ol className="replay-event-list">
          {meaningfulEvents.map(event => (
            <li key={`${event.index}-${event.raw}`} className={event.index <= cursor ? 'is-past' : ''}>
              <button type="button" onClick={() => seek(event.index)}>
                <span>{event.command === 'turn' ? event.args[0] : '·'}</span>
                <strong>{event.label}</strong>
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}
