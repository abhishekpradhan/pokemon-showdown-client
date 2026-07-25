import { RefreshCw, TrendingUp, Trophy } from 'lucide-react';
import { useState } from 'react';
import { SearchableSelect } from '../components/searchable-select';
import { useArenaStore } from '../stores/arena-store';

type LadderRow = {
  rank: number;
  name: string;
  elo: number;
  gxe?: number;
  record?: string;
};

export function LadderScreen() {
  const { formats, selectedFormat, setSelectedFormat } = useArenaStore();
  const [status, setStatus] = useState('Refresh to load the public standings for this format.');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LadderRow[]>([]);
  const selected = formats.find(format => format.id === selectedFormat);
  const formatOptions = formats.filter(format => format.searchShow).map(format => ({
    value: format.id,
    label: format.name,
    group: format.section || 'Ladder formats',
    description: format.team === false ? 'Preset team' : 'Custom team',
    meta: 'Ranked',
  }));

  const refresh = async () => {
    setLoading(true);
    setStatus(`Loading ${selected?.name || selectedFormat} standings…`);
    try {
      const response = await fetch(`https://pokemonshowdown.com/ladder/${selectedFormat}.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as {
        users?: Array<{
          username: string;
          elo?: number;
          gxe?: number;
          rpr?: number;
          w?: number;
          l?: number;
        }>;
      };
      const nextRows = (data.users || []).slice(0, 100).map((user, index) => ({
        rank: index + 1,
        name: user.username,
        elo: Math.round(user.elo || user.rpr || 0),
        gxe: user.gxe,
        record: user.w !== undefined || user.l !== undefined ? `${user.w || 0}–${user.l || 0}` : undefined,
      }));
      setRows(nextRows);
      setStatus(nextRows.length ? `${nextRows.length} ranked players loaded.` : 'The ladder returned no ranked players.');
    } catch (error) {
      setRows([]);
      setStatus(error instanceof Error ? `Ladder unavailable: ${error.message}` : 'Ladder unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="utility-workspace ladder-workspace" aria-label="Ladder">
      <main className="workspace-stage ladder-stage">
        <header className="stage-heading ladder-heading">
          <span>
            <small>Public rankings</small>
            <h1>Ladder</h1>
          </span>
          <button type="button" className="primary-action" disabled={loading} onClick={refresh}>
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
                <strong>No standings loaded.</strong>
                <span>Select a searchable format, then refresh the public ladder.</span>
              </div>
            )}
          </div>
        </div>
      </main>
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
              setRows([]);
              setStatus('Refresh to load the public standings for this format.');
            }}
          />
        </label>
        <dl className="inspector-facts">
          <div><dt>Source</dt><dd>Pokémon Showdown public ladder</dd></div>
          <div><dt>Rows</dt><dd>Top 100</dd></div>
          <div><dt>Refresh</dt><dd>On demand</dd></div>
        </dl>
      </aside>
    </section>
  );
}
