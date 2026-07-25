import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { gen, getAbility, getItem, getMove, isDexLoaded, loadDex, onDexLoaded } from '../data/dex';
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
const MAX_TOTAL_EVS = 508;

export function SetEditor({ set, formatId, onChange, onRemove }: {
  set: TeamSet;
  formatId: string;
  onChange: (next: TeamSet) => void;
  onRemove?: () => void;
}) {
  const ready = useDexReady();
  const [learnset, setLearnset] = useState<string[] | null>(null);

  useEffect(() => {
    void loadDex();
  }, []);

  const generation = gen(9);
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
    void generation.learnsets.get(species.id).then(data => {
      if (cancelled || !data?.learnset) return;
      setLearnset(Object.keys(data.learnset));
      setLearnsetFor(species.id);
    });
    return () => { cancelled = true; };
  }, [generation, ready, species]);
  const activeLearnset = species && learnsetFor === species.id ? learnset : null;

  const speciesOptions = useMemo(() => {
    if (!ready || !generation) return [];
    return [...generation.species].map(entry => ({
      value: entry.name,
      label: entry.name,
      group: entry.types.join(' / '),
      description: `#${entry.num}`,
    }));
  }, [generation, ready]);

  const itemOptions = useMemo(() => {
    if (!ready || !generation) return [];
    return [
      { value: '', label: 'No item', description: '' },
      ...[...generation.items].map(entry => ({
        value: entry.name,
        label: entry.name,
        description: entry.shortDesc?.slice(0, 60) || '',
      })),
    ];
  }, [generation, ready]);

  const abilityOptions = useMemo(() => {
    if (!species) return [];
    const abilities = Object.values(species.abilities || {}).filter(Boolean) as string[];
    return abilities.map(name => ({ value: name, label: name, description: '' }));
  }, [species]);

  const moveOptions = useMemo(() => {
    if (!ready || !generation) return [];
    const legal = activeLearnset ? new Set(activeLearnset) : null;
    return [...generation.moves]
      .filter(move => !legal || legal.has(move.id))
      .map(move => ({
        value: move.name,
        label: move.name,
        group: move.type,
        description: move.category === 'Status' ? 'Status' : `${move.basePower || '—'} BP`,
      }));
  }, [generation, activeLearnset, ready]);

  const natureOptions = useMemo(() => {
    if (!ready || !generation) return [];
    return [...generation.natures].map(nature => ({
      value: nature.name,
      label: nature.name,
      description: nature.plus && nature.minus ?
        `+${STAT_LABELS[nature.plus]} −${STAT_LABELS[nature.minus]}` :
        'Neutral',
    }));
  }, [generation, ready]);

  const evTotal = STAT_KEYS.reduce((total, key) => total + (set.evs?.[key] || 0), 0);

  // Teams imported from packed text carry ids ("closecombat"); the selects
  // speak display names. Canonicalize for display — writes then naturally
  // store display names, which is what the export format uses anyway.
  const itemValue = set.item ? (ready ? getItem(set.item)?.name ?? set.item : set.item) : '';
  const abilityValue = set.ability ? (ready ? getAbility(set.ability)?.name ?? set.ability : set.ability) : '';
  const moveValue = (index: number) => {
    const raw = set.moves[index] || '';
    if (!raw || !ready) return raw;
    return getMove(raw)?.name ?? raw;
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
    return <p className="set-editor-loading">Loading Pokédex…</p>;
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
          onValueChange={value => patch({ species: value, ability: undefined, moves: set.moves })}
        />
        {onRemove && (
          <button type="button" className="icon-button" aria-label={`Remove ${set.species || 'set'}`} onClick={onRemove}>
            <Trash2 size={15} />
          </button>
        )}
      </header>

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
          <span>Ability</span>
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
          <span>Tera type</span>
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
          Moves {activeLearnset ? <em>· {species?.name} learnset</em> : <em>· all moves</em>}
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
          EVs <em data-over={evTotal > MAX_TOTAL_EVS}>· {evTotal}/{MAX_TOTAL_EVS}</em>
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
                value={set.evs?.[key] ?? 0}
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
            value={set.level ?? 100}
            onChange={event => patch({ level: Math.max(1, Math.min(100, Number(event.currentTarget.value) || 100)) })}
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
      <span className="visually-hidden" aria-live="polite">
        {formatId ? `Editing for ${formatId}` : ''}
      </span>
    </div>
  );
}
