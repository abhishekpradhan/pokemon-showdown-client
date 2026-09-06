import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { createPortal } from 'react-dom';
import { defensiveTypes, type BattleChoice, type PokemonSet } from '../compat/battle-adapter';
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

export function TooltipTrigger({ content, children, className, label = 'Battle details' }: {
  content: () => ReactNode;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const tooltipId = useId();
  const [style, setStyle] = useState<CSSProperties>({});
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const inspectionRef = useRef<HTMLDivElement>(null);
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
    window.addEventListener('resize', place);
    window.addEventListener('scroll', hide, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open]);

  return (
    <span
      ref={anchorRef}
      className={['battle-tooltip-trigger', className].filter(Boolean).join(' ')}
      onPointerEnter={event => { if (event.pointerType === 'mouse' && !pinned) show(); }}
      onMouseLeave={hide}
      onFocus={event => { if (!pinned && !(event.target instanceof HTMLElement && event.target.closest('.touch-inspect'))) show(); }}
      onBlur={hide}
    >
      {isValidElement(children) ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': open && !pinned ? tooltipId : undefined }) : children}
      <Dialog.Root open={pinned} onOpenChange={setPinned}>
        <Dialog.Trigger asChild>
          <button type="button" className="touch-inspect" aria-label={`Inspect ${label}`} onClick={hide}>ⓘ</button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content ref={inspectionRef} className="battle-inspection account-dialog" onOpenAutoFocus={event => { event.preventDefault(); inspectionRef.current?.focus(); }}>
            <Dialog.Title className="visually-hidden">{label}</Dialog.Title>
            <Dialog.Description className="visually-hidden">Known battle information and move details.</Dialog.Description>
            {content()}
            <Dialog.Close className="secondary-action battle-details-close">Close details</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {open && !pinned && createPortal(
        <div className="battle-tooltip" id={tooltipId} ref={tipRef} style={style} role="tooltip">
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
        <div><dt>Base accuracy</dt><dd>{typeof accuracy === 'number' ? `${accuracy}%` : accuracy || '—'}</dd></div>
        <div><dt>PP</dt><dd>{move.ppLeft ?? '—'}/{move.ppMax ?? data?.pp ?? '—'}</dd></div>
        {data?.priority ? <div><dt>Priority</dt><dd>{data.priority > 0 ? `+${data.priority}` : data.priority}</dd></div> : null}
      </dl>
      {(move.description || data?.shortDesc) && <p className="tooltip-desc">{move.description || data?.shortDesc}</p>}
      {move.notes?.map(note => <p className="tooltip-desc" key={note}>{note}</p>)}
      {move.effectiveness && <p className="tooltip-desc">{move.effectiveness} against the displayed opponent. Unknown abilities and items may change the result.</p>}
    </>
  );
}

const STAT_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const STAT_LABELS: Record<(typeof STAT_ORDER)[number], string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

export function PokemonTooltip({ pokemon, format }: { pokemon: PokemonSet; format?: string }) {
  const species = getSpecies(pokemon.species, genFromFormat(format));
  const types = defensiveTypes(pokemon) ?? species?.types ?? [];
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
        <>
        <p className="tooltip-desc">{pokemon.stats ? 'Your reported stats (before stat stages)' : 'Species base stats'}</p>
        <div className="tooltip-stats">
          {STAT_ORDER.map(stat => (
            <span key={stat}>
              <dfn>{STAT_LABELS[stat]}</dfn>
              <i style={{ inlineSize: `${Math.min(100, species.baseStats[stat] / 2)}%` }} />
              <b>{pokemon.stats ? (stat === 'hp' ? pokemon.maxHp : pokemon.stats[stat]) ?? '—' : species.baseStats[stat]}</b>
            </span>
          ))}
        </div>
        </>
      )}
      {!pokemon.stats && pokemon.speedRange && <p className="tooltip-desc">Possible unmodified Speed: {pokemon.speedRange[0]}–{pokemon.speedRange[1]}.</p>}
      {pokemon.boosts && <p className="tooltip-desc">Stat stages: {Object.entries(pokemon.boosts).map(([stat, stage]) => `${stat.toUpperCase()} ${stage! > 0 ? '+' : ''}${stage}`).join(', ')}</p>}
      <p className="tooltip-desc">
        {pokemon.ability ? `Ability: ${pokemon.ability}` : abilities.length ? `Abilities: ${abilities.join(' / ')}` : ''}
        {pokemon.item ? `${pokemon.ability || abilities.length ? ' · ' : ''}Item: ${pokemon.item}` : ''}
      </p>
      {pokemon.lastItem && <p className="tooltip-desc">Previous item: {pokemon.lastItem}</p>}
      {!!pokemon.knownMoves?.length && <ul className="known-moves" aria-label="Known moves">
        {pokemon.knownMoves.map(move => <li key={move.name}><strong>{move.name}</strong> <span>{move.pp !== undefined ? `${move.pp}/${move.maxpp ?? '?'} PP` : Array.isArray(move.used) ? `${move.used.join('–')} PP used` : `${move.used ?? 0} PP used`}</span></li>)}
      </ul>}
      {pokemon.counters?.map(counter => <p className="tooltip-desc" key={counter}>{counter}</p>)}
    </>
  );
}
