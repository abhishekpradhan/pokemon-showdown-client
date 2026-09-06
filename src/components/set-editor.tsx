import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { calculateSetStats, defaultAbilityForSpecies, genForFormat, genFromFormat, getAbility, getItem, getMove, isDexLoaded, loadDex, onDexLoaded } from '../data/dex';
import { pokemonIconStyle } from '../data/sprites';
import { ALL_TYPES } from '../data/types';
import type { TeamSet } from '../compat/team-store';
import { SearchableSelect } from './searchable-select';

/**
 * Structured set editing, dex-backed: species/item/move autocomplete from the
 * loaded generation, abilities from the chosen species, moves filtered to its
 * learnset. Text import/export remains available beside it — this is the
 * editor for people who don't carry the packed format in their head.
 */

const useDexReady = () =>
  useSyncExternalStore(
    listener => {
      const off = onDexLoaded(listener);
      return () => { off(); };
    },
    isDexLoaded,
    isDexLoaded
  );

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const STAT_LABELS: Record<(typeof STAT_KEYS)[number], string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};
const MAX_TOTAL_EVS = 510;

export function SetEditor({ set, formatId, onChange, onRemove }: {
  set: TeamSet;
  formatId: string;
  onChange: (next: TeamSet) => void;
  onRemove?: () => void;
}) {
  const ready = useDexReady();
  const [learnset, setLearnset] = useState<string[] | null>(null);
  const [dexError, setDexError] = useState('');
  const [unrestricted, setUnrestricted] = useState(false);

  useEffect(() => {
    void loadDex().catch(() => setDexError('Pokédex could not load. Check your connection and retry.'));
  }, []);

  const generationNumber = genFromFormat(formatId);
  const permissive = unrestricted || /hackmons|almostanyability|customgame|balancedhackmons|mixandmega/.test(formatId);
  const generation = genForFormat(formatId, permissive);
  const defaultLevel = /vgc|bss|battlestadium|doublesflat/.test(formatId) ? 50 : /lc$/.test(formatId) ? 5 : 100;
  const species = ready && set.species ? generation?.species.get(set.species) : undefined;

  // Legal moves for the species; falls back to the full move list while the
  // learnset chunk loads or when the species has no data.
  // Tracks which species the loaded learnset belongs to, so a species change
  // falls back to "all moves" until its learnset arrives — without a
  // synchronous reset inside the effect.
  const [learnsetFor, setLearnsetFor] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!ready || !species || !generation) return;
    void generation.learnsets.learnable(species.id).then(data => {
      if (cancelled || !data) return;
      setLearnset(Object.keys(data));
      setLearnsetFor(`${generation.num}:${species.id}`);
    }).catch(() => { /* All moves remain available when learnset loading fails. */ });
    return () => { cancelled = true; };
  }, [generation, ready, species]);
  const activeLearnset = species && learnsetFor === `${generation?.num}:${species.id}` ? learnset : null;

  const speciesOptions = useMemo(() => {
    const generation = genForFormat(formatId, permissive);
    if (!ready || !generation) return [];
    return [...generation.species].map(entry => ({
      value: entry.name,
      label: entry.name,
      group: entry.types.join(' / '),
      description: `#${entry.num}`,
    }));
  }, [formatId, permissive, ready]);

  const itemOptions = useMemo(() => {
    const generation = genForFormat(formatId, permissive);
    if (!ready || !generation) return [];
    return [
      { value: '', label: 'No item', description: '' },
      ...[...generation.items].map(entry => ({
        value: entry.name,
        label: entry.name,
        description: entry.shortDesc?.slice(0, 60) || '',
      })),
    ];
  }, [formatId, permissive, ready]);

  const abilityOptions = useMemo(() => {
    const generation = genForFormat(formatId, permissive);
    const species = generation?.species.get(set.species);
    if (permissive && generation) return [{ value: '', label: 'No ability' }, ...[...generation.abilities].map(entry => ({ value: entry.name, label: entry.name }))];
    if (!species) return [];
    const abilities = Object.values(species.abilities || {}).filter(Boolean) as string[];
    return abilities.map(name => ({ value: name, label: name, description: '' }));
  }, [set.species, permissive, formatId]);

  const moveOptions = useMemo(() => {
    const generation = genForFormat(formatId, permissive);
    if (!ready || !generation) return [];
    const legal = !permissive && activeLearnset ? new Set(activeLearnset) : null;
    return [{ value: '', label: 'Clear move', group: 'Edit', description: '' }, ...[...generation.moves]
      .filter(move => !legal || legal.has(move.id))
      .map(move => ({
        value: move.name,
        label: move.name,
        group: move.type,
        description: move.category === 'Status' ? 'Status' : `${move.basePower || '—'} BP`,
      }))];
  }, [formatId, activeLearnset, ready, permissive]);

  const natureOptions = useMemo(() => {
    const generation = genForFormat(formatId, permissive);
    if (!ready || !generation) return [];
    return [...generation.natures].map(nature => ({
      value: nature.name,
      label: nature.name,
      description: nature.plus && nature.minus ?
        `+${STAT_LABELS[nature.plus]} −${STAT_LABELS[nature.minus]}` :
        'Neutral',
    }));
  }, [formatId, permissive, ready]);

  const evTotal = STAT_KEYS.reduce((total, key) => total + (set.evs?.[key] || 0), 0);

  // Teams imported from packed text carry ids ("closecombat"); the selects
  // speak display names. Canonicalize for display — writes then naturally
  // store display names, which is what the export format uses anyway.
  const itemValue = set.item ? (ready ? getItem(set.item, generationNumber)?.name ?? set.item : set.item) : '';
  const abilityValue = set.ability ? (ready ? getAbility(set.ability, generationNumber)?.name ?? set.ability : set.ability) : '';
  const moveValue = (index: number) => {
    const raw = set.moves[index] || '';
    if (!raw || !ready) return raw;
    return getMove(raw, generationNumber)?.name ?? raw;
  };

  const patch = (partial: Partial<TeamSet>) => onChange({ ...set, ...partial });

  const setMove = (index: number, value: string) => {
    const moves = [...set.moves];
    moves[index] = value;
    patch({ moves: moves.filter((move, position) => move || position < 4).slice(0, 4) });
  };

  const setEv = (key: (typeof STAT_KEYS)[number], raw: string) => {
    const value = Math.max(0, Math.min(252, Number(raw) || 0));
    patch({ evs: { ...set.evs, [key]: value } });
  };

  if (!ready) {
    return <p className="set-editor-loading" role="status">{dexError || 'Loading Pokédex…'}{dexError && <button type="button" onClick={() => { setDexError(''); void loadDex().catch(() => setDexError('Pokédex could not load. Retry when online.')); }}>Retry</button>}</p>;
  }

  return (
    <div className="set-editor">
      <header className="set-editor-heading">
        <span className="set-editor-icon" style={pokemonIconStyle(set.species || 'substitute')} aria-hidden />
        <SearchableSelect
          ariaLabel="Species"
          emptyLabel="No species match"
          options={speciesOptions}
          placeholder="Choose species"
          value={set.species}
          onValueChange={value => patch({ species: value, ability: defaultAbilityForSpecies(value, formatId), moves: set.moves })}
        />
        {onRemove && (
          <button type="button" className="icon-button" aria-label={`Remove ${set.species || 'set'}`} onClick={onRemove}>
            <Trash2 size={15} />
          </button>
        )}
      </header>

      <label className="set-unrestricted"><input type="checkbox" checked={unrestricted} onChange={event => setUnrestricted(event.currentTarget.checked)} /> Show all moves and abilities</label>
      <p className="set-editor-hint">Gen {generationNumber} suggestions. The server checks the selected format's clauses and custom rules.</p>
      <div className="set-editor-grid">
        <label className="set-field">
          <span>Item</span>
          <SearchableSelect
            ariaLabel="Held item"
            emptyLabel="No items match"
            options={itemOptions}
            placeholder="No item"
            value={itemValue}
            onValueChange={value => patch({ item: value || undefined })}
          />
        </label>
        <label className="set-field">
          <span>Ability {generationNumber < 3 ? "(unused in this generation)" : ""}</span>
          <SearchableSelect
            ariaLabel="Ability"
            emptyLabel={species ? 'No abilities' : 'Choose a species first'}
            options={abilityOptions}
            placeholder="Ability"
            value={abilityValue}
            onValueChange={value => patch({ ability: value || undefined })}
          />
        </label>
        <label className="set-field">
          <span>Nature</span>
          <SearchableSelect
            ariaLabel="Nature"
            emptyLabel="No natures match"
            options={natureOptions}
            placeholder="Nature"
            value={set.nature || ''}
            onValueChange={value => patch({ nature: value || undefined })}
          />
        </label>
        <label className="set-field">
          <span>Tera type {generationNumber < 9 ? "(Gen 9)" : ""}</span>
          <SearchableSelect
            ariaLabel="Tera type"
            emptyLabel="No types match"
            options={ALL_TYPES.filter(type => type !== '???').map(type => ({ value: type, label: type, description: '' }))}
            placeholder="Tera"
            value={set.teraType || ''}
            onValueChange={value => patch({ teraType: value || undefined })}
          />
        </label>
      </div>

      <div className="set-editor-moves">
        <span className="set-section-label">
          Moves {!permissive && activeLearnset ? <em>· {species?.name} learnset</em> : <em>· all moves</em>}
        </span>
        <div className="set-editor-grid">
          {[0, 1, 2, 3].map(index => (
            <SearchableSelect
              key={index}
              ariaLabel={`Move ${index + 1}`}
              emptyLabel="No moves match"
              options={moveOptions}
              placeholder={`Move ${index + 1}`}
              value={moveValue(index)}
              onValueChange={value => setMove(index, value)}
            />
          ))}
        </div>
      </div>

      <div className="set-editor-evs">
        <span className="set-section-label">
          EVs <em data-over={generationNumber > 2 && evTotal > MAX_TOTAL_EVS}>· {evTotal}/{generationNumber <= 2 ? 1512 : MAX_TOTAL_EVS}</em>
        </span>
        <div className="ev-grid">
          {STAT_KEYS.map(key => (
            <label className="ev-field" key={key}>
              <span>{STAT_LABELS[key]}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={252}
                step={4}
                value={set.evs?.[key] ?? (generationNumber <= 2 ? 252 : 0)}
                onChange={event => setEv(key, event.currentTarget.value)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="set-editor-grid is-compact">
        <label className="set-field">
          <span>Level</span>
          <input
            className="set-plain-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={set.level ?? defaultLevel}
            onChange={event => patch({ level: Math.max(1, Math.min(100, Number(event.currentTarget.value) || defaultLevel)) })}
          />
        </label>
        <label className="set-field">
          <span>Nickname</span>
          <input
            className="set-plain-input"
            value={set.name || ''}
            placeholder={set.species || 'Optional'}
            onChange={event => patch({ name: event.currentTarget.value || undefined })}
          />
        </label>
      </div>
      <div className="set-editor-evs">
        <span className="set-section-label">{generationNumber <= 2 ? 'DVs' : 'IVs'} and calculated stats</span>
        <div className="ev-grid">
          {STAT_KEYS.map(key => {
            const iv = set.ivs?.[key] ?? 31;
            const actual = calculateSetStats(set, generationNumber, defaultLevel)?.[key];
            return <label className="ev-field" key={key}><span>{STAT_LABELS[key]}</span><input aria-label={`${STAT_LABELS[key]} ${generationNumber <= 2 ? 'DV' : 'IV'}`} type="number" min={0} max={generationNumber <= 2 ? 15 : 31} value={generationNumber <= 2 ? Math.floor(iv / 2) : iv} onChange={event => { const value = Math.max(0, Math.min(generationNumber <= 2 ? 15 : 31, Math.trunc(Number(event.currentTarget.value) || 0))); patch({ ivs: { ...set.ivs, [key]: generationNumber <= 2 ? value * 2 + 1 : value } }); }} /><output>{actual ?? '—'}</output></label>;
          })}
        </div>
        <div className="button-row">
          <button type="button" className="secondary-action" onClick={() => patch({ ivs: { ...set.ivs, atk: 0 } })}>Minimum Attack</button>
          <button type="button" className="secondary-action" onClick={() => patch({ ivs: { ...set.ivs, spe: 0 } })}>Minimum Speed</button>
          <button type="button" className="secondary-action" onClick={() => patch({ ivs: undefined })}>Reset IVs</button>
          <button type="button" className="secondary-action" onClick={() => patch({ evs: { atk: 252, spe: 252, spd: 4 }, nature: 'Jolly' })}>Fast physical</button>
          <button type="button" className="secondary-action" onClick={() => patch({ evs: { spa: 252, spe: 252, spd: 4 }, nature: 'Timid' })}>Fast special</button>
        </div>
      </div>
      <details className="set-details"><summary>Set details</summary><div className="set-editor-grid is-compact">
        <label className="set-field"><span>Gender</span><select value={set.gender || ''} onChange={event => patch({ gender: event.currentTarget.value || undefined })}><option value="">Default</option><option value="M">Male</option><option value="F">Female</option><option value="N">Genderless</option></select></label>
        <label className="set-field"><span>Shiny</span><input aria-label="Shiny" type="checkbox" checked={!!set.shiny} onChange={event => patch({ shiny: event.currentTarget.checked })} /></label>
        <label className="set-field"><span>Happiness</span><input type="number" min={0} max={255} value={set.happiness ?? 255} onChange={event => patch({ happiness: Math.max(0, Math.min(255, Number(event.currentTarget.value) || 0)) })} /></label>
        <label className="set-field"><span>Hidden Power type</span><select value={set.hpType || ''} onChange={event => patch({ hpType: event.currentTarget.value || undefined })}><option value="">Default</option>{ALL_TYPES.filter(type => !['???', 'Normal', 'Fairy', 'Stellar'].includes(type)).map(type => <option key={type}>{type}</option>)}</select></label>
        <label className="set-field"><span>Poké Ball</span><input value={set.pokeball || ''} placeholder="Default" onChange={event => patch({ pokeball: event.currentTarget.value || undefined })} /></label>
        {(generationNumber === 8 || set.dynamaxLevel !== undefined || set.gigantamax) && <>
          <label className="set-field"><span>Dynamax level</span><input type="number" min={0} max={10} value={set.dynamaxLevel ?? 10} onChange={event => patch({ dynamaxLevel: Math.max(0, Math.min(10, Number(event.currentTarget.value) || 0)) })} /></label>
          <label className="set-field"><span>Gigantamax</span><input type="checkbox" checked={!!set.gigantamax} onChange={event => patch({ gigantamax: event.currentTarget.checked })} /></label>
        </>}
      </div></details>
    </div>
  );
}
