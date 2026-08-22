import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { BattleChoice, PokemonSet } from '../compat/battle-adapter';
import { genFromFormat, getMove, getSpecies } from '../data/dex';
import { typeStyle } from '../data/types';

/**
 * Hover/focus tooltips for the battle screen: the dex facts you'd otherwise
 * alt-tab for. Pure info, never interactive — they follow the pointer's
 * element, render in a body portal (ancestor overflow clips), and vanish on
 * leave, blur, or Escape. Touch devices keep the info panel instead; hover
 * is a fine-pointer affordance.
 */

const SHOW_DELAY = 120;

export function TooltipTrigger({ content, children, className }: {
  content: () => ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), SHOW_DELAY);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const tip = tipRef.current?.getBoundingClientRect();
      if (!anchor || !tip) return;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (!vw || !vh) {
        setStyle({ position: 'fixed', left: anchor.left, top: anchor.bottom + 8 });
        return;
      }
      const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - tip.width / 2, vw - tip.width - 8));
      const above = anchor.top - tip.height - 8;
      const top = above >= 8 ? above : Math.min(anchor.bottom + 8, vh - tip.height - 8);
      setStyle({ position: 'fixed', left, top });
    };
    place();
    const raf = requestAnimationFrame(place);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') hide(); };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span
      ref={anchorRef}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && createPortal(
        <div className="battle-tooltip" ref={tipRef} style={style} role="tooltip">
          {content()}
        </div>,
        document.body
      )}
    </span>
  );
}

export function MoveTooltip({ move, format }: { move: BattleChoice; format?: string }) {
  const data = getMove(move.name, genFromFormat(format));
  const accuracy = move.accuracy === true || data?.accuracy === true ?
    'Never misses' :
    move.accuracy ?? data?.accuracy;
  return (
    <>
      <header className="tooltip-heading">
        <strong>{move.name}</strong>
        <span className="type-chip" style={typeStyle(move.type)}>{move.type}</span>
      </header>
      <dl className="tooltip-facts">
        <div><dt>Category</dt><dd>{move.category ?? data?.category ?? '—'}</dd></div>
        <div><dt>Power</dt><dd>{move.basePower || data?.basePower || '—'}</dd></div>
        <div><dt>Accuracy</dt><dd>{typeof accuracy === 'number' ? `${accuracy}%` : accuracy || '—'}</dd></div>
        <div><dt>PP</dt><dd>{move.ppLeft ?? '—'}/{move.ppMax ?? data?.pp ?? '—'}</dd></div>
        {data?.priority ? <div><dt>Priority</dt><dd>{data.priority > 0 ? `+${data.priority}` : data.priority}</dd></div> : null}
      </dl>
      {data?.shortDesc && <p className="tooltip-desc">{data.shortDesc}</p>}
    </>
  );
}

const STAT_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const STAT_LABELS: Record<(typeof STAT_ORDER)[number], string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

export function PokemonTooltip({ pokemon, format }: { pokemon: PokemonSet; format?: string }) {
  const species = getSpecies(pokemon.species, genFromFormat(format));
  const types = pokemon.terastallized ? [pokemon.terastallized] : (pokemon.types ?? species?.types ?? []);
  const abilities = pokemon.ability ?
    [pokemon.ability] :
    species ? Object.values(species.abilities).filter(Boolean) : [];
  return (
    <>
      <header className="tooltip-heading">
        <strong>{pokemon.species}{pokemon.level && pokemon.level !== 100 ? ` · L${pokemon.level}` : ''}</strong>
        <span className="tooltip-types">
          {types.map(type => <span className="type-chip" key={type} style={typeStyle(type)}>{type}</span>)}
        </span>
      </header>
      {species && (
        <div className="tooltip-stats">
          {STAT_ORDER.map(stat => (
            <span key={stat}>
              <dfn>{STAT_LABELS[stat]}</dfn>
              <i style={{ inlineSize: `${Math.min(100, species.baseStats[stat] / 2)}%` }} />
              <b>{species.baseStats[stat]}</b>
            </span>
          ))}
        </div>
      )}
      <p className="tooltip-desc">
        {pokemon.ability ? `Ability: ${pokemon.ability}` : abilities.length ? `Abilities: ${abilities.join(' / ')}` : ''}
        {pokemon.item ? `${pokemon.ability || abilities.length ? ' · ' : ''}Item: ${pokemon.item}` : ''}
      </p>
    </>
  );
}
