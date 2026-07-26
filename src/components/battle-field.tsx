import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { BOOST_LABELS, type ArenaBattle, type BoostId, type PokemonSet, type SideCondition } from '../compat/battle-adapter';
import { genFromFormat } from '../data/dex';
import { pokemonSprite } from '../data/sprites';
import { STATUS_LABELS, typeStyle } from '../data/types';

function HealthBar({ pokemon, hidden }: { pokemon: PokemonSet; hidden: boolean }) {
  const percent = Math.max(0, Math.min(100, pokemon.hp));
  const tone = percent > 50 ? 'high' : percent > 20 ? 'mid' : 'low';
  // Exact HP is only ever known for your own side.
  const exact = pokemon.currentHp !== undefined && pokemon.maxHp !== undefined ?
    `${pokemon.currentHp}/${pokemon.maxHp}` : null;

  return (
    <div className="hp-block">
      <div
        className="hp-track"
        role="progressbar"
        aria-valuenow={hidden ? undefined : Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pokemon.name} HP`}
      >
        <motion.i
          className="hp-fill"
          data-tone={tone}
          initial={false}
          animate={{ width: `${hidden ? 100 : percent}%` }}
          transition={{ type: 'spring', stiffness: 220, damping: 30 }}
        />
      </div>
      <span className="hp-readout">
        {hidden ? '???' : exact || `${Math.round(percent)}%`}
      </span>
    </div>
  );
}

/** Stat stages, most-changed first, so the important ones read at a glance. */
function BoostChips({ boosts }: { boosts: PokemonSet['boosts'] }) {
  const entries = Object.entries(boosts || {}) as [BoostId, number][];
  if (!entries.length) return null;
  return (
    <>
      {entries
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .map(([stat, stage]) => (
          <span className="boost-chip" key={stat} data-direction={stage > 0 ? 'up' : 'down'}>
            {stage > 0 ? '+' : ''}{stage} {BOOST_LABELS[stat]}
          </span>
        ))}
    </>
  );
}

function SideConditions({ conditions, label, side }: {
  conditions?: SideCondition[];
  label: string;
  side: 'near' | 'far';
}) {
  if (!conditions?.length) return null;
  return (
    <div className={`side-conditions is-${side}`} role="group" aria-label={label}>
      {conditions.map(condition => (
        <span key={condition.name}>
          {condition.name}{condition.layers > 1 && <i>×{condition.layers}</i>}
        </span>
      ))}
    </div>
  );
}

function Combatant({ battle, hideHealth = false, pokemon, side, position = 0, positions = 1, event }: {
  battle: ArenaBattle;
  hideHealth?: boolean;
  pokemon: PokemonSet;
  side: 'near' | 'far';
  /** Slot index and slot count on this side — doubles staggers positions. */
  position?: number;
  positions?: number;
  event?: BattleEvent;
}) {
  const eventHere = event && event.side === side && (event.slot ?? 0) === position;
  const eventClass = eventHere ? `is-${event.kind}` : '';
  const sprite = pokemonSprite(pokemon.species, {
    side,
    gen: genFromFormat(battle.format),
    shiny: pokemon.shiny,
    gender: pokemon.gender,
  });
  const status = pokemon.status ? STATUS_LABELS[pokemon.status] : null;

  return (
    <motion.div
      className={clsx('combatant', `combatant-${side}`, pokemon.fainted && 'is-fainted', eventClass)}
      data-position={position}
      data-positions={positions}
      initial={{ opacity: 0, y: side === 'near' ? 20 : -20 }}
      animate={{ opacity: pokemon.fainted ? 0.35 : 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="combatant-nameplate">
        <div className="nameplate-row">
          <strong>{pokemon.name}</strong>
          {pokemon.level && pokemon.level !== 100 && <span className="nameplate-level">L{pokemon.level}</span>}
          {pokemon.gender && <span className={`nameplate-gender is-${pokemon.gender}`}>{pokemon.gender === 'M' ? '♂' : '♀'}</span>}
          {pokemon.terastallized && (
            <span className="tera-badge" style={typeStyle(pokemon.terastallized)} title={`Terastallized: ${pokemon.terastallized}`}>
              {pokemon.terastallized}
            </span>
          )}
        </div>
        <HealthBar pokemon={pokemon} hidden={hideHealth} />
        <div className="nameplate-tags">
          <BoostChips boosts={pokemon.boosts} />
          {pokemon.volatiles?.map(volatile => (
            <span className="volatile-chip" key={volatile}>{volatile}</span>
          ))}
          {!hideHealth && status && (
            <span className="status-chip" style={{ '--status-color': status.color } as React.CSSProperties} title={status.label}>
              {pokemon.status}
            </span>
          )}
          {!hideHealth && !pokemon.terastallized && pokemon.types?.map(type => (
            <span className="type-chip" key={type} style={typeStyle(type)}>{type}</span>
          ))}
        </div>
      </div>
      <div className="combatant-sprite" key={eventHere ? event.at : 'idle'}>
        <img
          src={sprite.url}
          alt={`${pokemon.name}, ${pokemon.species}`}
          width={sprite.width}
          height={sprite.height}
          style={{ imageRendering: sprite.pixelated ? 'pixelated' : 'auto' }}
          loading="eager"
        />
      </div>
    </motion.div>
  );
}

function RosterPips({ team, hidden, label }: { team: PokemonSet[]; hidden: boolean; label: string }) {
  const remaining = team.filter(pokemon => !(pokemon.fainted || pokemon.hp <= 0)).length;
  return (
    <span
      className="roster-pips"
      role="img"
      aria-label={`${label}: ${remaining} of ${team.length} remaining`}
    >
      {team.map(pokemon => (
        <i
          key={`${pokemon.slot}-${pokemon.species}`}
          data-fainted={pokemon.fainted || pokemon.hp <= 0}
          title={hidden ? 'Unrevealed' : `${pokemon.name} · ${Math.round(pokemon.hp)}%`}
        />
      ))}
    </span>
  );
}

export type BattleEvent = {
  kind: 'attack' | 'hit' | 'faint';
  side: 'near' | 'far';
  slot?: number;
  at: number;
};

export function BattleField({ battle, hardcore = false, lastEvent }: {
  battle: ArenaBattle;
  hardcore?: boolean;
  lastEvent?: BattleEvent;
}) {
  const nearPlayer = battle.playerSide === 'p2' ? battle.p2 : battle.p1;
  const farPlayer = battle.playerSide === 'p2' ? battle.p1 : battle.p2;
  const effects = [battle.weather, ...(battle.fieldConditions || [])].filter(Boolean) as string[];

  // Positions come from the protocol slot, not the array index: a fainted
  // slot leaves a gap, and the survivor must hold its ground. The slot count
  // keeps the doubles stagger while one side is down to a single Pokémon.
  const farSlots = battle.opponentActives?.length ? battle.opponentActives : [battle.opponentActive];
  const nearSlots = battle.actives?.length ? battle.actives : [battle.active];
  const farCount = battle.opponentActives?.length ?
    Math.max(...battle.opponentActives.map(pokemon => pokemon.slot), battle.opponentActives.length) : 1;
  const nearCount = battle.actives?.length ?
    Math.max(...battle.actives.map(pokemon => pokemon.slot), battle.actives.length) : 1;

  return (
    <div className="battle-field" aria-label="Battle field" data-weather={battle.weather || 'clear'}>
      <div className="field-backdrop" aria-hidden />
      <div className="field-vignette" aria-hidden />

      <header className="field-hud">
        <span className="field-player">
          {farPlayer.name}
          {farPlayer.rating > 0 && <i>{farPlayer.rating}</i>}
          <RosterPips team={battle.opponentTeam} hidden={hardcore} label={`${farPlayer.name}'s team`} />
        </span>
        <strong className="field-turn">Turn {battle.turn || '—'}</strong>
      </header>

      <SideConditions conditions={battle.opponentSideConditions} label="Opponent's side conditions" side="far" />
      {farSlots.map(pokemon => (
        <Combatant
          key={`far-${pokemon.slot}`}
          battle={battle}
          hideHealth={hardcore}
          pokemon={pokemon}
          side="far"
          position={farCount > 1 ? pokemon.slot - 1 : 0}
          positions={farCount}
          event={lastEvent}
        />
      ))}
      {nearSlots.map(pokemon => (
        <Combatant
          key={`near-${pokemon.slot}`}
          battle={battle}
          pokemon={pokemon}
          side="near"
          position={nearCount > 1 ? pokemon.slot - 1 : 0}
          positions={nearCount}
          event={lastEvent}
        />
      ))}
      <SideConditions conditions={battle.sideConditions} label="Your side conditions" side="near" />

      {effects.length > 0 && (
        <div className="field-effects" role="group" aria-label="Field conditions">
          {effects.map(effect => <span key={effect}>{effect}</span>)}
        </div>
      )}

      <footer className="field-hud is-near">
        <span className="field-player">
          {nearPlayer.name}
          {nearPlayer.rating > 0 && <i>{nearPlayer.rating}</i>}
          <RosterPips team={battle.team} hidden={false} label="Your team" />
        </span>
      </footer>
    </div>
  );
}
