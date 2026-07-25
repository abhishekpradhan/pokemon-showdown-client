import { RefreshCw, TrendingUp, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SearchableSelect } from '../components/searchable-select';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';

/** Shape of an entry in `/ladder/<format>.json`. */
type LadderEntry = {
  username: string;
  elo?: number;
  gxe?: number;
  rpr?: number;
  w?: number;
  l?: number;
  t?: number;
};

const LADDER_HOST = import.meta.env.VITE_PS_LADDER_HOST || 'https://pokemonshowdown.com';

type LadderRow = {
  rank: number;
  name: string;
  elo: number;
  gxe?: number;
  record?: string;
};

export function LadderScreen() {
  const { formats, selectedFormat, setSelectedFormat } = useArenaStore(
    useShallow(state => ({ formats: state.formats, selectedFormat: state.selectedFormat, setSelectedFormat: state.setSelectedFormat }))
  );
  const [rows, setRows] = useState<LadderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const selected = formats.find(format => format.id === selectedFormat);
  const formatOptions = formats.filter(format => format.searchShow).map(format => ({
    value: format.id,
    label: format.name,
    group: format.section || 'Ladder formats',
    description: format.team === false ? 'Preset team' : 'Custom team',
    meta: 'Ranked',
  }));

  // Data fetching lives in an effect keyed on the format, with cancellation so
  // a slow response for a previous format cannot overwrite a newer one. All
  // state updates happen after the await, never synchronously in the effect.
  const [loadedFormat, setLoadedFormat] = useState<string | null>(null);
  const loading = loadedFormat !== selectedFormat && !error;

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(`${LADDER_HOST}/ladder/${selectedFormat}.json`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // The endpoint returns { formatid, format, toplist }. Reading `users`
        // here meant the table was always empty and reported "no ranked
        // players" for every format.
        const data = await response.json() as { toplist?: LadderEntry[] };
        if (controller.signal.aborted) return;

        setRows((data.toplist || []).slice(0, 100).map((user, index) => ({
          rank: index + 1,
          name: user.username,
          elo: Math.round(user.elo ?? user.rpr ?? 0),
          gxe: user.gxe,
          record: user.w !== undefined || user.l !== undefined ?
            `${user.w || 0}–${user.l || 0}${user.t ? `–${user.t}` : ''}` : undefined,
        })));
        setError(null);
        setLoadedFormat(selectedFormat);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setRows([]);
        setError(caught instanceof Error ? caught.message : 'Ladder unavailable.');
        setLoadedFormat(selectedFormat);
      }
    })();

    return () => controller.abort();
  }, [selectedFormat, reloadToken]);

  const status = error ? `Ladder unavailable: ${error}` :
    loading ? 'Loading standings…' :
    rows.length ? `Top ${rows.length} ranked players.` :
    'No ranked players yet for this format.';

  return (
    <section className="utility-workspace ladder-workspace" aria-label="Ladder">
      <div className="workspace-stage ladder-stage">
        <header className="stage-heading ladder-heading">
          <span>
            <small>Public rankings</small>
            <h1>Ladder</h1>
          </span>
          <button type="button" className="primary-action" disabled={loading} onClick={() => setReloadToken(token => token + 1)}>
            <RefreshCw size={14} aria-hidden /> {loading ? 'Loading…' : 'Refresh'}
          </button>
        </header>
        <div className="ladder-summary">
          <span>
            <Trophy size={17} aria-hidden />
            <strong>{selected?.name || selectedFormat}</strong>
          </span>
          <p role="status" aria-live="polite">{status}</p>
        </div>
        <div className="ladder-table" role="table" aria-label={`${selected?.name || selectedFormat} standings`}>
          <div className="ladder-table-head" role="row">
            <span role="columnheader">Rank</span>
            <span role="columnheader">Player</span>
            <span role="columnheader">Elo</span>
            <span role="columnheader">GXE</span>
            <span role="columnheader">Record</span>
          </div>
          <div className="ladder-table-body">
            {rows.map(row => (
              <div className="ladder-table-row" role="row" key={`${row.rank}-${row.name}`}>
                <span role="cell">{String(row.rank).padStart(2, '0')}</span>
                <strong role="cell">{row.name}</strong>
                <span role="cell">{row.elo}</span>
                <span role="cell">{row.gxe?.toFixed(1) || '—'}</span>
                <span role="cell">{row.record || '—'}</span>
              </div>
            ))}
            {!rows.length && (
              <div className="table-empty">
                <TrendingUp size={22} aria-hidden />
                <strong>{loading ? 'Loading standings…' : 'No standings available.'}</strong>
                <span>{loading ? 'Fetching the public ladder.' : 'This format may not have a ranked ladder yet.'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <aside className="workspace-inspector ladder-inspector">
        <header className="inspector-heading">
          <span>
            <small>Scope</small>
            <strong>Ranking format</strong>
          </span>
        </header>
        <label className="inspector-control">
          <span>Format</span>
          <SearchableSelect
            ariaLabel="Select ladder format"
            emptyLabel="No ladder formats"
            options={formatOptions}
            placeholder="Choose format"
            value={selectedFormat}
            onValueChange={value => {
              setSelectedFormat(value);
              setError(null);
            }}
          />
        </label>
        <dl className="inspector-facts">
          <div><dt>Source</dt><dd>Pokémon Showdown public ladder</dd></div>
          <div><dt>Rows</dt><dd>Top 100</dd></div>
          <div><dt>Refresh</dt><dd>On format change</dd></div>
        </dl>
      </aside>
    </section>
  );
}
