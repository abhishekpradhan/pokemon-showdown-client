import { ChevronLeft, ChevronRight, Download, Pause, Play, RotateCcw, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { BattleField } from '../components/battle-field';
import { ChatFeed } from '../components/chat-feed';
import { StatusCallout } from '../components/status-callout';
import { createBattleHistory, flipBattleView, loadEngine, type BattleHistoryPoint } from '../battle/engine';
import { describeBattleLine } from '../compat/battle-text';
import { fetchReplay, loadReplayCollection, normalizeReplayUrl, parseReplayLog, MAX_REPLAY_BYTES, REPLAY_HOST, saveReplayCollection, searchReplays, type LoadedReplay, type ReplaySearchResult } from '../replays/replay-data';

const LOCAL_REPLAY_KEY = 'ps-arena-local-replay-v1';
const downloadLog = (log: string, id: string) => { const url = URL.createObjectURL(new Blob([log], { type: 'text/plain' })); const link = document.createElement('a'); link.href = url; link.download = `${id.replace(/[^a-z0-9-]/gi, '_')}.log`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };

function entriesThrough<T extends { index: number }>(entries: T[], line: number, limit: number): T[] {
  let low = 0; let high = entries.length;
  while (low < high) { const middle = (low + high) >>> 1; if (entries[middle].index <= line) low = middle + 1; else high = middle; }
  return entries.slice(Math.max(0, low - limit), low);
}

export function ReplaysScreen() {
  const route = useSearch({ from: '/replays' });
  const navigate = useNavigate();
  const [input, setInput] = useState(route.replay || '');
  const [replay, setReplay] = useState<LoadedReplay | null>(null);
  const [points, setPoints] = useState<readonly BattleHistoryPoint[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [side, setSide] = useState<'p1' | 'p2'>(route.side || 'p1');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Open a replay URL, ID, or battle log.');
  const [error, setError] = useState('');
  const [collection, setCollection] = useState(loadReplayCollection);
  const [searchUser, setSearchUser] = useState('');
  const [searchFormat, setSearchFormat] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [searchResults, setSearchResults] = useState<ReplaySearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState('');
  const activeLoad = useRef<AbortController | null>(null);
  const activeSearch = useRef<AbortController | null>(null);
  const loadedAddress = useRef('');
  const requestNumber = useRef(0);

  const openReplay = async (source: string, targetTurn?: number, targetSide?: 'p1' | 'p2', updateAddress = true, targetStep?: number) => {
    if (!source.trim()) { setError('Paste a replay URL, ID or protocol log first.'); return; }
    activeLoad.current?.abort();
    const controller = new AbortController(); activeLoad.current = controller;
    const request = ++requestNumber.current;
    const timeout = window.setTimeout(() => controller.abort(new Error('Replay request timed out. Retry when connected.')), 20_000);
    setLoading(true); setError(''); setPlaying(false);
    try {
      let value = source;
      if (source === 'local') { value = sessionStorage.getItem(LOCAL_REPLAY_KEY) || ''; if (!value) throw new Error('The local log is no longer stored in this tab. Import it again.'); }
      const isLog = value.includes('\n') || value.startsWith('|');
      const sourceView = isLog ? undefined : normalizeReplayUrl(value);
      const requestedTurn = targetTurn ?? sourceView?.turn ?? 1;
      const requestedSide = targetSide ?? sourceView?.side ?? 'p1';
      const loaded = isLog ? parseReplayLog(value) : await fetchReplay(value, controller.signal);
      await loadEngine();
      if (controller.signal.aborted || request !== requestNumber.current) return;
      const history = createBattleHistory(loaded.id, '', { turnsOnly: true, maxPoints: 5000 });
      if (!history) throw new Error('Battle engine could not initialize.');
      const timeline = history.synchronize(loaded.lines);
      if (!timeline.length) throw new Error('No playable battle events found.');
      const turnIndex = timeline.findIndex(point => point.turn >= requestedTurn);
      setReplay(loaded); setPoints(timeline); setCursor(targetStep !== undefined ? Math.min(timeline.length - 1, targetStep) : turnIndex >= 0 ? turnIndex : timeline.length - 1); setSide(requestedSide);
      setStatus(`${loaded.players.join(' vs. ')} · ${loaded.format || 'Battle'} · ${loaded.lines.length.toLocaleString()} lines`);
      loadedAddress.current = loaded.url || 'local';
      if (loaded.url) {
        setCollection(current => { const previous = current.find(entry => entry.url === loaded.url); const next = [{ id: loaded.id, url: loaded.url, format: loaded.format, players: loaded.players, private: loaded.private, viewedAt: Date.now(), bookmarked: previous?.bookmarked }, ...current.filter(entry => entry.url !== loaded.url)].slice(0, 100); if (!saveReplayCollection(next)) setError('Replay opened, but recent history could not be saved.'); return next; });
      } else {
        try { sessionStorage.setItem(LOCAL_REPLAY_KEY, loaded.log); } catch { setError('Local replay opened, but reload recovery is unavailable. Download the log to keep it.'); }
      }
      if (updateAddress) void navigate({ to: '/replays', search: { replay: loaded.url || 'local', turn: requestedTurn, step: targetStep, side: requestedSide }, replace: true });
    } catch (caught) {
      if (request !== requestNumber.current) return;
      if (controller.signal.aborted) setError(controller.signal.reason instanceof Error ? controller.signal.reason.message : 'Replay loading cancelled.');
      else setError(caught instanceof Error ? caught.message : 'Replay could not load.');
    } finally { window.clearTimeout(timeout); if (request === requestNumber.current) setLoading(false); }
  };

  useEffect(() => {
    if (!route.replay) return;
    let address = route.replay;
    try { if (address !== 'local') address = normalizeReplayUrl(address).url; } catch { /* Loader reports invalid addresses. */ }
    if (address !== loadedAddress.current) {
      void openReplay(route.replay, route.turn, route.side, false, route.step);
    } else {
      // Restore external address navigation without rebuilding the engine.
      const index = route.step ?? points.findIndex(entry => entry.turn >= (route.turn ?? 1));
      setCursor(Math.max(0, Math.min(points.length - 1, index < 0 ? points.length - 1 : index)));
      setSide(route.side || 'p1');
    }
    // Only address changes trigger restoration; playback advances independently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.replay, route.turn, route.step, route.side]);
  useEffect(() => () => { activeLoad.current?.abort(); activeSearch.current?.abort(); requestNumber.current++; }, []);
  useEffect(() => {
    if (!playing || !points.length) return;
    const timer = window.setInterval(() => setCursor(current => { if (current >= points.length - 1) { setPlaying(false); return current; } return current + 1; }), 1200 / speed);
    return () => window.clearInterval(timer);
  }, [playing, points.length, speed]);

  const point = points[cursor];
  const battle = point ? side === 'p2' ? flipBattleView(point.battle) : point.battle : null;
  const narrationEntries = useMemo(() => replay ? replay.lines.map((raw, index) => { const [, command = '', ...args] = raw.split('|'); return { index, text: describeBattleLine({ command, args }) }; }).filter(entry => entry.text) : [], [replay]);
  const chatEntries = useMemo(() => replay ? replay.lines.flatMap((raw, index) => { const [, command, ...args] = raw.split('|'); return command === 'c' || command === 'chat' ? [{ index, user: args[0] || '', message: args.slice(1).join('|') }] : command === 'c:' ? [{ index, user: args[1] || '', message: args.slice(2).join('|'), timestamp: Number(args[0]) * 1000 }] : []; }) : [], [replay]);
  const narration = entriesThrough(narrationEntries, point?.line ?? -1, 1000);
  const chat = entriesThrough(chatEntries, point?.line ?? -1, 200);
  const seek = (next: number) => {
    const index = Math.max(0, Math.min(points.length - 1, next)); setCursor(index); setPlaying(false);
    if (replay) void navigate({ to: '/replays', search: { replay: replay.url || 'local', turn: points[index]?.turn || 0, step: index, side }, replace: true });
  };
  const switchSide = () => { const next = side === 'p1' ? 'p2' : 'p1'; setSide(next); if (replay) void navigate({ to: '/replays', search: { replay: replay.url || 'local', turn: point?.turn || 0, step: cursor, side: next }, replace: true }); };
  const search = async (page = 1) => {
    activeSearch.current?.abort(); const controller = new AbortController(); activeSearch.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15_000); setSearchStatus('Searching…');
    try { const results = await searchReplays(searchUser, searchFormat, page, controller.signal); if (controller.signal.aborted) return; setSearchResults(results); setSearchPage(page); setSearchStatus(results.length ? `${Math.min(50, results.length)} results · page ${page}` : 'No matching public replays.'); }
    catch (caught) { if (activeSearch.current === controller) setSearchStatus(caught instanceof Error ? `Search unavailable: ${caught.message}` : 'Search unavailable.'); }
    finally { window.clearTimeout(timeout); }
  };
  const openSearchResult = (result: ReplaySearchResult) => { const address = `${REPLAY_HOST}/${result.id}${result.password ? `-${result.password}pw` : ''}`; setInput(address); void openReplay(address); };
  const bookmarked = !!collection.find(entry => entry.url === replay?.url)?.bookmarked;
  const toggleBookmark = () => {
    const next = collection.map(entry => entry.url === replay?.url ? { ...entry, bookmarked: !entry.bookmarked } : entry);
    if (saveReplayCollection(next)) setCollection(next); else setError('Bookmark could not be saved to browser storage.');
  };

  return <section className="utility-workspace replay-workspace" aria-label="Replays">
    <div className="workspace-stage replay-stage"><header className="stage-heading replay-heading"><span><small>Battle review</small><h1>Replays</h1></span><span className="replay-status" role="status">{status}</span></header>
      {error && <StatusCallout tone="error">{error}</StatusCallout>}
      {replay && <div className="replay-source-meta"><span>{replay.url ? replay.private || /-[a-z0-9]+pw(?:\?|$)/i.test(replay.url) ? 'Protected replay link — share only with intended viewers.' : 'Replay link from its source server.' : 'Local log — saved only for this browser tab. Download it to keep a copy.'}</span>{replay.uploadtime && <time>{new Date(replay.uploadtime * 1000).toLocaleDateString()}</time>}{replay.url && <><a href={replay.url} target="_blank" rel="noopener noreferrer">Original replay</a><button type="button" className="secondary-action" onClick={toggleBookmark}><Star size={14} fill={bookmarked ? 'currentColor' : 'none'} />{bookmarked ? 'Bookmarked' : 'Bookmark'}</button><button type="button" className="secondary-action" onClick={() => { const link = new URL(window.location.href); link.searchParams.set('replay', replay.url || 'local'); link.searchParams.set('turn', String(point?.turn || 0)); link.searchParams.set('step', String(cursor)); link.searchParams.set('side', side); void navigator.clipboard.writeText(link.toString()).then(() => setStatus('Replay link copied.')).catch(() => setError('Copy failed. Copy the browser address manually.')); }}>Copy playback link</button></>}<button type="button" className="secondary-action" onClick={() => downloadLog(replay.log, replay.id)}><Download size={14} /> Download log</button></div>}
      <div className="replay-canvas">{battle && <BattleField battle={battle} />}{!battle && <div className="replay-empty"><Play size={24} /><strong>Load a battle to start reviewing.</strong></div>}</div>
      <div className="replay-transport" aria-label="Replay controls"><button type="button" aria-label="Restart replay" disabled={!points.length} onClick={() => seek(0)}><RotateCcw size={15} /></button><button type="button" aria-label="Previous turn" disabled={!points.length || cursor <= 0} onClick={() => seek(cursor - 1)}><ChevronLeft size={16} /></button><button type="button" className="transport-play" aria-label={playing ? 'Pause replay' : 'Play replay'} disabled={!points.length} onClick={() => { if (cursor === points.length - 1) setCursor(0); setPlaying(value => !value); }}>{playing ? <Pause size={17} /> : <Play size={17} />}</button><button type="button" aria-label="Next turn" disabled={!points.length || cursor >= points.length - 1} onClick={() => seek(cursor + 1)}><ChevronRight size={16} /></button><input type="range" aria-label="Replay timeline" min={0} max={Math.max(0, points.length - 1)} value={cursor} disabled={!points.length} onChange={event => seek(Number(event.currentTarget.value))} /><span>Turn {point?.turn || 0}</span></div>
      <div className="replay-playback-options"><label>Speed<select aria-label="Playback speed" value={speed} onChange={event => setSpeed(Number(event.currentTarget.value))}>{[.25, .5, 1, 2, 4].map(value => <option key={value} value={value}>{value}×</option>)}</select></label><label>Go to turn<input aria-label="Go to turn" type="number" min={0} max={points.at(-1)?.turn || 0} value={point?.turn || 0} onChange={event => { const target = Number(event.currentTarget.value); const index = points.findIndex(entry => entry.turn >= target); if (index >= 0) seek(index); }} /></label><button type="button" className="secondary-action" disabled={!battle} onClick={switchSide}>Switch sides</button></div>
      <details className="replay-narration" open><summary>Battle narration</summary><ol>{narration.map(entry => <li key={entry.index}>{entry.text}</li>)}</ol></details><details className="replay-narration"><summary>Replay chat ({chat.length})</summary><ChatFeed messages={chat} /></details>
    </div>
    <aside className="workspace-inspector replay-inspector"><div className="replay-loader"><header className="inspector-heading"><span><small>Source</small><strong>Replay loader</strong></span></header><textarea aria-label="Replay log input" placeholder="Replay URL, ID or protocol log" value={input} onChange={event => setInput(event.currentTarget.value)} /><div className="button-row"><button type="button" className="primary-action" disabled={loading} onClick={() => void openReplay(input)}>{loading ? 'Loading…' : 'Load replay'}</button>{loading && <button type="button" className="secondary-action" onClick={() => activeLoad.current?.abort(new Error('Replay loading cancelled.'))}>Cancel</button>}</div><label>Open log file<input type="file" accept=".log,.txt" onChange={event => { const file = event.currentTarget.files?.[0]; if (file && file.size > MAX_REPLAY_BYTES) { setError('Replay is larger than 5 MB.'); return; } if (file) void file.text().then(text => { setInput(text); void openReplay(text); }).catch(() => setError('Could not read that file.')); }} /></label><small>Up to 5 MB, 50,000 lines and 2,000 turns.</small></div>
      <form className="replay-search" onSubmit={event => { event.preventDefault(); void search(); }}><strong>Find public replays</strong><label>Player<input aria-label="Replay search player" value={searchUser} onChange={event => setSearchUser(event.currentTarget.value)} /></label><label>Format<input aria-label="Replay search format" placeholder="gen9ou" value={searchFormat} onChange={event => setSearchFormat(event.currentTarget.value)} /></label><button type="submit" className="secondary-action">Search replays</button><p role="status">{searchStatus}</p></form><ol className="replay-result-list">{searchResults.slice(0, 50).map(result => <li key={result.id}><button type="button" onClick={() => openSearchResult(result)}>{result.players.join(' vs. ')}<small>{result.format}</small></button></li>)}</ol>{searchResults.length > 0 && <div className="button-row"><button type="button" disabled={searchPage <= 1} onClick={() => void search(searchPage - 1)}>Previous page</button><button type="button" disabled={searchResults.length <= 50} onClick={() => void search(searchPage + 1)}>Next page</button></div>}
      <details className="replay-collection" open><summary>Recent / bookmarked ({collection.length})</summary>{collection.slice().sort((a, b) => Number(!!b.bookmarked) - Number(!!a.bookmarked)).map(entry => <button type="button" key={entry.url} onClick={() => { setInput(entry.url || ''); void openReplay(entry.url || ''); }}>{entry.bookmarked ? '★ ' : ''}{entry.players.join(' vs. ')}<small>{entry.format}</small></button>)}</details>
    </aside>
  </section>;
}
