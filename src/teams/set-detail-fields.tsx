import type { StatTable, TeamSet } from '../compat/team-store';
import { ALL_TYPES } from '../data/types';

type Props = { set: TeamSet; generation: number; onChange: (set: TeamSet) => void };
const labels = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };

export function SetIVFields({ set, generation, calculatedStats, onChange }: Props & { calculatedStats: StatTable | null }) {
  const oldGeneration = generation <= 2;
  const patch = (change: Partial<TeamSet>) => onChange({ ...set, ...change });
  return <details className="set-details set-iv-details">
    <summary>{oldGeneration ? 'DVs' : 'IVs'} and calculated stats</summary>
    <div className="ev-grid">
      {(Object.keys(labels) as Array<keyof StatTable>).map(stat => {
        const iv = set.ivs?.[stat] ?? 31;
        return <label className="ev-field" key={stat}>
          <span>{labels[stat]}</span>
          <input
            aria-label={`${labels[stat]} ${oldGeneration ? 'DV' : 'IV'}`}
            type="number"
            min={0}
            max={oldGeneration ? 15 : 31}
            value={oldGeneration ? Math.floor(iv / 2) : iv}
            onChange={event => {
              const value = Math.max(0, Math.min(oldGeneration ? 15 : 31, Math.trunc(Number(event.currentTarget.value) || 0)));
              patch({ ivs: { ...set.ivs, [stat]: oldGeneration ? value * 2 + 1 : value } });
            }}
          />
          <output>{calculatedStats?.[stat] ?? '—'}</output>
        </label>;
      })}
    </div>
    <div className="button-row">
      <button type="button" className="secondary-action" onClick={() => patch({ ivs: { ...set.ivs, atk: 0 } })}>Minimum Attack</button>
      <button type="button" className="secondary-action" onClick={() => patch({ ivs: { ...set.ivs, spe: 0 } })}>Minimum Speed</button>
      <button type="button" className="secondary-action" onClick={() => patch({ ivs: undefined })}>Reset IVs</button>
    </div>
  </details>;
}

export function SetDetailFields({ set, generation, onChange }: Props) {
  const patch = (change: Partial<TeamSet>) => onChange({ ...set, ...change });
  return <details className="set-details">
    <summary>Set details</summary>
    <div className="set-editor-grid is-compact">
      <label className="set-field">
        <span>Gender</span>
        <select aria-label="Gender" value={set.gender || ''} onChange={event => patch({ gender: event.currentTarget.value || undefined })}>
          <option value="">Default</option><option value="M">Male</option><option value="F">Female</option><option value="N">Genderless</option>
        </select>
      </label>
      <label className="set-field">
        <span>Shiny</span>
        <input aria-label="Shiny" type="checkbox" checked={!!set.shiny} onChange={event => patch({ shiny: event.currentTarget.checked })} />
      </label>
      <label className="set-field">
        <span>Happiness</span>
        <input type="number" min={0} max={255} value={set.happiness ?? 255} onChange={event => patch({ happiness: Math.max(0, Math.min(255, Number(event.currentTarget.value) || 0)) })} />
      </label>
      <label className="set-field">
        <span>Hidden Power type</span>
        <select aria-label="Hidden Power type" value={set.hpType || ''} onChange={event => patch({ hpType: event.currentTarget.value || undefined })}>
          <option value="">Default</option>
          {ALL_TYPES.filter(type => !['???', 'Normal', 'Fairy', 'Stellar'].includes(type)).map(type => <option key={type}>{type}</option>)}
        </select>
      </label>
      <label className="set-field">
        <span>Poké Ball</span>
        <input value={set.pokeball || ''} placeholder="Default" onChange={event => patch({ pokeball: event.currentTarget.value || undefined })} />
      </label>
      {(generation === 8 || set.dynamaxLevel !== undefined || set.gigantamax) && <>
        <label className="set-field">
          <span>Dynamax level</span>
          <input type="number" min={0} max={10} value={set.dynamaxLevel ?? 10} onChange={event => patch({ dynamaxLevel: Math.max(0, Math.min(10, Number(event.currentTarget.value) || 0)) })} />
        </label>
        <label className="set-field">
          <span>Gigantamax</span>
          <input type="checkbox" checked={!!set.gigantamax} onChange={event => patch({ gigantamax: event.currentTarget.checked })} />
        </label>
      </>}
    </div>
  </details>;
}
