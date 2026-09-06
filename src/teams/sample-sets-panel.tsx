import { useEffect, useState } from 'react';
import { SearchableSelect } from '../components/searchable-select';
import { exportTeam, type TeamSet } from '../compat/team-store';
import { applySampleSet, fetchSampleSets, sampleSetUrl, type SampleSet } from './sample-sets';

type Props = { set: TeamSet; format: string; onChange: (set: TeamSet) => void };

function SampleSetBrowser({ set, format, onChange }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; samples: SampleSet[]; error?: string }>();
  const [selected, setSelected] = useState('');
  const [applied, setApplied] = useState<{ before: TeamSet; after: string; name: string }>();
  const key = `${format}:${set.species}:${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    void fetchSampleSets(format, set.species, controller.signal).then(samples => {
      if (!controller.signal.aborted) setResult({ key, samples });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, samples: [], error: error instanceof Error ? error.message : 'Sample sets could not load. Check your connection and retry.' });
    });
    return () => controller.abort();
  }, [format, set.species, key]);

  const current = result?.key === key ? result : undefined;
  const sample = current?.samples.find(entry => entry.id === selected) || current?.samples[0];
  const preview = sample ? applySampleSet(set, sample) : undefined;
  const canUndo = applied?.after === JSON.stringify(set);
  let sourceUrl: string | undefined;
  try { sourceUrl = sampleSetUrl(format); } catch { /* The loading state explains unsupported format IDs. */ }

  return <div className="sample-set-browser">
    <p className="set-suggestion-note">
      Analysis and usage samples for <strong>{format}</strong>, hosted by Pokémon Showdown.
      {sourceUrl && <> <a href={sourceUrl} target="_blank" rel="noopener noreferrer">View source data</a>.</>}
      {' '}Samples are starting points; use server validation for current legality.
    </p>
    {!current && <p role="status">Loading sample sets…</p>}
    {current?.error && <div className="set-suggestion-error" role="alert">
      <p>{current.error}</p>
      <button type="button" className="secondary-action" onClick={() => setAttempt(value => value + 1)}>Retry sample sets</button>
    </div>}
    {current && !current.error && !current.samples.length && <p role="status">No published sample sets for {set.species} in {format}. You can still edit or import a set manually.</p>}
    {sample && preview && <>
      <SearchableSelect
        ariaLabel="Sample set"
        options={current!.samples.map(entry => ({ value: entry.id, label: entry.name, group: entry.source === 'analysis' ? 'Smogon analysis' : 'Showdown usage', description: entry.source === 'analysis' ? 'Analysis sample' : 'Usage-derived sample' }))}
        value={sample.id}
        onValueChange={setSelected}
      />
      <p className="set-suggestion-note">Preview: supplied sample fields replace this Pokémon’s corresponding fields. Nickname and other personal details are retained.</p>
      <pre className="sample-set-preview" aria-label="Sample set preview" tabIndex={0}>{exportTeam([preview])}</pre>
      <button type="button" className="secondary-action" disabled={JSON.stringify(preview) === JSON.stringify(set)} onClick={() => {
        setApplied({ before: structuredClone(set), after: JSON.stringify(preview), name: sample.name });
        onChange(preview);
      }}>Apply sample set</button>
    </>}
    {canUndo && <div className="set-suggestion-applied" role="status">
      <span>Applied {applied.name}. Save the team to update your library.</span>
      <button type="button" className="secondary-action" onClick={() => { onChange(applied.before); setApplied(undefined); }}>Undo sample set</button>
    </div>}
  </div>;
}

/** Mounted with the current species/format key so requests and Undo cannot cross sets. */
export function SampleSetsPanel(props: Props) {
  const [open, setOpen] = useState(false);
  return <section className="set-sample-section" aria-label="Competitive sample sets">
    <button type="button" className="secondary-action" aria-expanded={open} disabled={!props.set.species} onClick={() => setOpen(value => !value)}>
      {open ? 'Close sample sets' : 'Browse sample sets'}
    </button>
    {open && <SampleSetBrowser {...props} />}
  </section>;
}
