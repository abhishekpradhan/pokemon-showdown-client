import { RefreshCw, TrendingUp, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { SearchableSelect } from '../components/searchable-select';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';
import { requestPublicLadder, requestServerLadder, type LadderRow } from '../compat/ladder';

const LADDER_HOST = import.meta.env.VITE_PS_LADDER_HOST || 'https://pokemonshowdown.com';

export function LadderScreen() {
  const { formats, selectedFormat, server, protocol, connection } = useArenaStore(useShallow(state => ({ formats: state.formats, selectedFormat: state.selectedFormat, server: state.server, protocol: state.protocol, connection: state.connection })));
  const route = useSearch({ from: '/ladder' });
  const navigate = useNavigate();
  const format = route.format || selectedFormat;
  const user = route.user || '';
  const exact = !!route.exact;
  const inputKey = `${user}/${exact}`;
  const [inputDraft, setInputDraft] = useState({ key: inputKey, user, exact });
  const userInput = inputDraft.key === inputKey ? inputDraft.user : user;
  const exactInput = inputDraft.key === inputKey ? inputDraft.exact : exact;
  const setUserInput = (value: string) => setInputDraft({ key: inputKey, user: value, exact: exactInput });
  const setExactInput = (value: boolean) => setInputDraft({ key: inputKey, user: userInput, exact: value });
  const [data, setData] = useState<{ key: string; rows: LadderRow[]; error?: string; loading: boolean }>({ key: '', rows: [], loading: true });
  const [reloadToken, setReloadToken] = useState(0);
  const [limit, setLimit] = useState(100);
  const selected = formats.find(entry => entry.id === format);
  const localLadder = server.id !== 'showdown' || (!/(^|\.)psim\.us$/.test(server.host) && server.host !== 'sim.smogon.com');
  const requestKey = `${server.host}:${server.port}/${format}/${user}/${exact}/${reloadToken}`;
  const loading = data.key !== requestKey || data.loading;
  const rows = data.key === requestKey ? data.rows : [];
  const error = data.key === requestKey ? data.error : undefined;

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(new Error('The ranking request timed out. Retry when connected.')), 20_000);
    void (async () => {
      try {
        if (localLadder && connection !== 'connected') throw new Error('Connect to this server to load its rankings.');
        const next = localLadder ? await requestServerLadder(protocol, format, user, controller.signal) : await requestPublicLadder(LADDER_HOST, format, user, exact, controller.signal);
        if (!controller.signal.aborted) setData({ key: requestKey, rows: next, loading: false });
      } catch (caught) {
        if (controller.signal.aborted && !controller.signal.reason?.message?.includes('timed out')) return;
        setData({ key: requestKey, rows: [], loading: false, error: controller.signal.aborted ? 'Request timed out. Retry when connected.' : caught instanceof Error ? caught.message : 'Rankings unavailable.' });
      } finally { window.clearTimeout(timer); }
    })();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [connection, exact, format, localLadder, protocol, requestKey, user]);

  const status = error ? error : loading ? 'Loading standings…' : rows.length ? `${rows.length} ${user ? 'matching' : 'ranked'} player${rows.length === 1 ? '' : 's'}.` : user ? 'No rating found for that player in this format.' : 'No ranked players yet for this format.';
  const shown = rows.slice(0, limit);
  const showCoil = rows.some(row => row.coil !== undefined);
  return <section className="utility-workspace ladder-workspace" aria-label="Ladder">
    <div className="workspace-stage ladder-stage"><header className="stage-heading ladder-heading"><span><small>{localLadder ? server.id : 'Public'} rankings</small><h1>Ladder</h1></span><button type="button" className="primary-action" disabled={loading} onClick={() => setReloadToken(value => value + 1)}><RefreshCw size={14} />{loading ? 'Loading…' : 'Refresh'}</button></header>
      <div className="ladder-summary"><span><Trophy size={17} /><strong>{selected?.name || format}</strong></span><p role={error ? 'alert' : 'status'} aria-live="polite">{status}</p></div>
      <form className="ladder-player-search" onSubmit={event => { event.preventDefault(); setLimit(100); void navigate({ to: '/ladder', search: { format, user: userInput.trim() || undefined, exact: exactInput } }); }}><label>Player name or prefix<input aria-label="Ladder player search" value={userInput} onChange={event => setUserInput(event.currentTarget.value)} placeholder="Find your ranking" /></label><label><input type="checkbox" checked={exactInput} onChange={event => setExactInput(event.currentTarget.checked)} />Exact player{localLadder ? ' (uses server prefix lookup)' : ''}</label><button type="submit" className="secondary-action" disabled={loading}>Find player</button>{user && <button type="button" className="secondary-action" onClick={() => { setUserInput(''); void navigate({ to: '/ladder', search: { format } }); }}>Clear search</button>}</form>
      <div className="ladder-table-scroll" tabIndex={0} role="region" aria-label="Standings, scrollable" aria-busy={loading}>{loading && <div className="ladder-skeleton" aria-hidden>{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</div>}{!loading && <table className="ladder-table"><caption className="visually-hidden">{selected?.name || format} rankings</caption><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col"><abbr title="Rating used for matchmaking and ladder position">Elo</abbr></th><th scope="col"><abbr title="Glicko X-Act Estimate: estimated percentage chance of beating a random player">GXE</abbr></th><th scope="col"><abbr title="Glicko rating ± rating deviation; deviation above 100 is provisional">Glicko-1</abbr></th>{showCoil && <th scope="col"><abbr title="Consistency of individual ladder outcomes, used for some suspect tests">COIL</abbr></th>}<th scope="col">Record</th></tr></thead><tbody>{shown.map(row => <tr key={`${row.rank}-${row.username}`}><td>{row.rank || '—'}</td><th scope="row"><button type="button" className="ladder-user-link" onClick={() => { setInputDraft({ key: `${row.username}/true`, user: row.username, exact: true }); void navigate({ to: '/ladder', search: { format, user: row.username, exact: true } }); }}>{row.username}</button></th><td>{row.elo !== undefined ? Math.round(row.elo) : '—'}</td><td>{row.gxe !== undefined ? `${row.gxe.toFixed(1)}%` : '—'}</td><td>{row.glicko !== undefined ? `${Math.round(row.glicko)}${row.deviation !== undefined ? ` ± ${Math.round(row.deviation)}` : ''}` : '—'}{row.deviation !== undefined && row.deviation > 100 && <small> provisional</small>}</td>{showCoil && <td>{row.coil?.toFixed(0) || '—'}</td>}<td>{row.record || '—'}</td></tr>)}</tbody></table>}{!loading && !rows.length && <div className="table-empty"><TrendingUp size={22} /><strong>{error ? 'Rankings could not load.' : 'No matching standings.'}</strong><span>{error ? 'Refresh to retry.' : user ? 'Try a different player or format.' : 'This format may not have a ranked ladder yet.'}</span></div>}</div>{rows.length > limit && <button type="button" className="secondary-action" onClick={() => setLimit(value => value + 100)}>Show 100 more ({shown.length} of {rows.length})</button>}
    </div>
    <aside className="workspace-inspector ladder-inspector"><header className="inspector-heading"><span><small>Scope</small><strong>Ranking format</strong></span></header><label className="inspector-control"><span>Format</span><SearchableSelect ariaLabel="Select ladder format" options={formats.filter(entry => entry.searchShow).map(entry => ({ value: entry.id, label: entry.name, group: entry.section || 'Ladder formats' }))} value={format} onValueChange={next => { setLimit(100); void navigate({ to: '/ladder', search: { format: next, user: user || undefined, exact } }); }} /></label><dl className="inspector-facts"><div><dt>Source</dt><dd>{localLadder ? server.host : new URL(LADDER_HOST).hostname}</dd></div><div><dt>Rows</dt><dd>{rows.length || '—'}</dd></div><div><dt>Scope</dt><dd>{user ? exact ? 'Player rating' : 'Username prefix' : 'Top rankings'}</dd></div></dl><p className="ladder-metric-help">GXE estimates win probability. Glicko deviation measures uncertainty; higher deviation makes a rating provisional. Browse formats here without changing your matchmaking selection.</p></aside>
  </section>;
}
