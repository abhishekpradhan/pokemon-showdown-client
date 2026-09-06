import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { calculateSetStats, defaultAbilityForSpecies, genForFormat, genFromFormat, getAbility, getItem, getMove, isDexLoaded, loadDex, onDexLoaded } from '../data/dex';
import { pokemonIconStyle } from '../data/sprites';
import { ALL_TYPES } from '../data/types';
import type { TeamSet } from '../compat/team-store';
import { SearchableSelect } from './searchable-select';
import { SampleSetsPanel } from '../teams/sample-sets-panel';
import { SpreadSuggestionPanel } from '../teams/spread-suggestion-panel';
import { SetDetailFields, SetIVFields } from '../teams/set-detail-fields';

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

export function SetEditor({ set, formatId, onChange, onRemove, focusSpecies = false }: {
  set: TeamSet;
  formatId: string;
  onChange: (next: TeamSet) => void;
  onRemove?: () => void;
  focusSpecies?: boolean;
}) {
  const ready = useDexReady();
  const [learnset, setLearnset] = useState<string[] | null>(null);
  const [dexError, setDexError] = useState('');
  const [unrestricted, setUnrestricted] = useState(false);
  const headingRef = useRef<HTMLElement>(null);
  const focusOrigin = useRef<Element | null>(null);

  useEffect(() => {
    void loadDex().catch(() => setDexError('Pokédex could not load. Check your connection and retry.'));
  }, []);

  useEffect(() => {
    if (!focusSpecies) return;
    focusOrigin.current ??= document.activeElement;
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      // The dex may arrive after the user has moved on to another field or
      // dialog. Deferred focus must not interrupt that newer interaction.
      if (document.activeElement !== focusOrigin.current) return;
      const trigger = headingRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Species"]');
      trigger?.focus({ preventScroll: true });
      trigger?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, focusSpecies]);

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
    if (!ready) return [];
    const generation = genForFormat(formatId, permissive);
    const species = generation?.species.get(set.species);
    if (permissive && generation) return [{ value: '', label: 'No ability' }, ...[...generation.abilities].map(entry => ({ value: entry.name, label: entry.name }))];
    if (!species) return [];
    const abilities = Object.values(species.abilities || {}).filter(Boolean) as string[];
    return abilities.map(name => ({ value: name, label: name, description: '' }));
  }, [set.species, permissive, formatId, ready]);

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

  const evTotal = STAT_KEYS.reduce((total, key) => total + (set.evs?.[key] ?? (generationNumber <= 2 ? 252 : 0)), 0);
  const calculatedStats = calculateSetStats(set, generationNumber, defaultLevel);

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
      <header className="set-editor-heading" ref={headingRef}>
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

      <SampleSetsPanel key={`${formatId}:${set.species}`} set={set} format={formatId} onChange={onChange} />

      <div className="set-editor-grid">
        {(generationNumber >= 2 || set.item) && <label className="set-field">
          <span>Item</span>
          <SearchableSelect
            ariaLabel="Held item"
            emptyLabel="No items match"
            options={itemOptions}
            placeholder="No item"
            value={itemValue}
            onValueChange={value => patch({ item: value || undefined })}
          />
        </label>}
        {(generationNumber >= 3 || set.ability) && <label className="set-field">
          <span>Ability</span>
          <SearchableSelect
            ariaLabel="Ability"
            emptyLabel={species ? 'No abilities' : 'Choose a species first'}
            options={abilityOptions}
            placeholder="Ability"
            value={abilityValue}
            onValueChange={value => patch({ ability: value || undefined })}
          />
        </label>}
        {(generationNumber >= 3 || set.nature) && <label className="set-field">
          <span>Nature</span>
          <SearchableSelect
            ariaLabel="Nature"
            emptyLabel="No natures match"
            options={natureOptions}
            placeholder="Nature"
            value={set.nature || ''}
            onValueChange={value => patch({ nature: value || undefined })}
          />
        </label>}
        {(generationNumber >= 9 || set.teraType) && <label className="set-field">
          <span>Tera type</span>
          <SearchableSelect
            ariaLabel="Tera type"
            emptyLabel="No types match"
            options={ALL_TYPES.filter(type => type !== '???').map(type => ({ value: type, label: type, description: '' }))}
            placeholder="Tera"
            value={set.teraType || ''}
            onValueChange={value => patch({ teraType: value || undefined })}
          />
        </label>}
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
              value={moveValue(index) || undefined}
              onValueChange={value => setMove(index, value)}
            />
          ))}
        </div>
        <label className="set-unrestricted"><input type="checkbox" checked={unrestricted} onChange={event => setUnrestricted(event.currentTarget.checked)} /> Show all moves and abilities</label>
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
                aria-label={`${STAT_LABELS[key]} EV`}
                type="number"
                inputMode="numeric"
                min={0}
                max={252}
                step={4}
                value={set.evs?.[key] ?? (generationNumber <= 2 ? 252 : 0)}
                onChange={event => setEv(key, event.currentTarget.value)}
              />
              <output aria-label={`${STAT_LABELS[key]} calculated stat`}>{calculatedStats?.[key] ?? '—'}</output>
            </label>
          ))}
        </div>
        <SpreadSuggestionPanel key={`${formatId}:${set.species}`} set={set} format={formatId} onChange={onChange} />
        {generationNumber >= 3 && <div className="set-ev-presets">
          <span>Quick spread</span>
          <button type="button" onClick={() => patch({ evs: { atk: 252, spe: 252, spd: 4 }, nature: 'Jolly' })}>Fast physical</button>
          <button type="button" onClick={() => patch({ evs: { spa: 252, spe: 252, spd: 4 }, nature: 'Timid' })}>Fast special</button>
          <button type="button" onClick={() => patch({ evs: undefined })}>Reset EVs</button>
        </div>}
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
      <SetIVFields set={set} generation={generationNumber} calculatedStats={calculatedStats} onChange={onChange} />
      <SetDetailFields set={set} generation={generationNumber} onChange={onChange} />
    </div>
  );
}
