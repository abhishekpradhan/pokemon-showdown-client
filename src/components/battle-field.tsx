import { clsx } from 'clsx';
import { BOOST_LABELS, battleSideIndex, isFourPlayerBattle, type ArenaBattle, type ArenaBattleSide, type BattleSideID, type BoostId, type PokemonSet, type SideCondition } from '../compat/battle-adapter';
import { PokemonTooltip, TooltipTrigger } from './battle-tooltip';
import { genFromFormat } from '../data/dex';
import { pokemonSprite } from '../data/sprites';
import { STATUS_LABELS, typeStyle } from '../data/types';
import { useWorkspaceStore } from '../stores/workspace-store';

function HealthBar({ pokemon, hidden }: { pokemon: PokemonSet; hidden: boolean }) {
  const percent = Math.max(0, Math.min(100, pokemon.hp));
  const tone = percent > 50 ? 'high' : percent > 20 ? 'mid' : 'low';
  // Exact HP comes only from a private roster disclosed by the server.
  const exact = pokemon.currentHp !== undefined && pokemon.maxHp !== undefined ?
    `${pokemon.currentHp}/${pokemon.maxHp}` : null;

  return (
    <div className="hp-block">
      <div
        className="hp-track"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pokemon.name} HP`}
      >
        <i className="hp-fill" data-tone={tone} style={{ width: `${percent}%` }} />
      </div>
      {/* Hardcore keeps the gauge — a cartridge shows the bar — and drops
          only the numeric readout. */}
      {!hidden && (
        <span className="hp-readout">{exact || `${Math.round(percent)}%`}</span>
      )}
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
          {condition.duration && <small> {condition.duration[0] === condition.duration[1] ? condition.duration[0] : condition.duration.join('–')} turns</small>}
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
  const eventHere = event && (event.sideId ? event.sideId === pokemon.sideId : event.side === side) && (event.slot ?? 0) === position;
  const reducedMotion = useWorkspaceStore(state => state.reducedMotion);
  const eventClass = eventHere ? `is-${event.kind}` : '';
  const sprite = pokemonSprite(pokemon.species, {
    side,
    gen: battle.generation || genFromFormat(battle.format),
    shiny: pokemon.shiny,
    gender: pokemon.gender,
    still: reducedMotion,
  });
  const status = pokemon.status ? STATUS_LABELS[pokemon.status] : null;

  return (
    <div
      className={clsx('combatant', `combatant-${side}`, pokemon.fainted && 'is-fainted', eventClass)}
      data-position={position}
      data-positions={positions}
    >
      <div className="combatant-nameplate">
        <div className="nameplate-row">
          <TooltipTrigger label={pokemon.name} content={() => <PokemonTooltip pokemon={pokemon} format={`gen${battle.generation || genFromFormat(battle.format)}`} />}>
            <strong tabIndex={0} className="nameplate-name">{pokemon.name}</strong>
          </TooltipTrigger>
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
          {/* Status is on-cartridge information: never hidden. */}
          {status && (
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
    </div>
  );
}

function RosterPips({ team, total = team.length, hidden, label }: { team: PokemonSet[]; total?: number; hidden: boolean; label: string }) {
  const remaining = total - team.filter(pokemon => pokemon.fainted || pokemon.hp <= 0).length;
  return (
    <span
      className="roster-pips"
      role="img"
      aria-label={`${label}: ${remaining} of ${total} remaining`}
    >
      {team.map(pokemon => (
        <i
          key={`${pokemon.slot}-${pokemon.species}`}
          data-fainted={pokemon.fainted || pokemon.hp <= 0}
          title={hidden ? 'Unrevealed' : `${pokemon.name} · ${pokemon.hpKnown === false ? 'HP unknown' : `${Math.round(pokemon.hp)}%`}`}
        />
      ))}
      {Array.from({ length: Math.max(0, total - team.length) }, (_, index) => <i key={`unknown-${index}`} data-unrevealed title="Unrevealed Pokémon" />)}
    </span>
  );
}

export type BattleEvent = {
  kind: 'attack' | 'hit' | 'faint' | 'note';
  side: 'near' | 'far';
  sideId?: BattleSideID;
  slot?: number;
  at: number;
  label?: string;
};

function LayoutSide({ owner, battle, half, hardcore, event, preview }: {
  owner: ArenaBattleSide; battle: ArenaBattle; half: 'near' | 'far'; hardcore: boolean; event?: BattleEvent; preview: boolean;
}) {
  const four = isFourPlayerBattle(battle.gameType);
  const viewpoint = battle.playerSide || 'p1';
  const own = owner.id === viewpoint;
  const ally = battle.gameType === 'multi' && battleSideIndex(owner.id) % 2 === battleSideIndex(viewpoint) % 2 && !own;
  const relation = own ? battle.mode === 'player' ? 'You' : 'Viewpoint' : ally ? 'Partner' : 'Opponent';
  const count = four ? 1 : 3;
  const positions = Array.from({ length: count }, (_, index) => index);
  if (half === 'far') positions.reverse();
  return <section className="layout-side" aria-label={`${owner.name}'s side`} data-owner={owner.id}>
    <header className="layout-owner">
      <span><strong>{owner.name}</strong><small>{relation}{owner.rating > 0 ? ` · ${owner.rating}` : ''}</small></span>
      <RosterPips team={owner.team} total={owner.teamSize} hidden={hardcore} label={`${owner.name}'s team`} />
    </header>
    {preview ? <div className="layout-preview" aria-label={`${owner.name}'s team preview`}>
      {owner.team.map(pokemon => <TooltipTrigger key={pokemon.slot} label={pokemon.name} content={() => <PokemonTooltip pokemon={pokemon} format={`gen${battle.generation || 9}`} />}>
        <span tabIndex={0} className="layout-preview-pokemon"><img src={pokemonSprite(pokemon.species, { side: 'far', still: true }).url} alt="" width={40} height={40} /><strong>{pokemon.species}</strong></span>
      </TooltipTrigger>)}
      {owner.team.length < owner.teamSize && <small>{owner.teamSize - owner.team.length} Pokémon unrevealed</small>}
    </div> : <div className="layout-active-grid" data-count={count}>
      {positions.map(index => {
        const pokemon = owner.actives.find(pokemon => pokemon.slot === index + 1);
        return pokemon ? <Combatant key={index} battle={battle} pokemon={pokemon} side={half} position={index} positions={count} hideHealth={hardcore} event={event} /> :
          <div className="layout-empty-position" key={index}>Position {index + 1} empty</div>;
      })}
    </div>}
    {!!owner.conditions.length && <div className="layout-side-conditions" aria-label={`${owner.name}'s side conditions`}>
      {owner.conditions.map(condition => <span key={condition.name}>{condition.name}{condition.layers > 1 ? ` ×${condition.layers}` : ''}{condition.duration ? ` · ${condition.duration.join('–')} turns` : ''}</span>)}
    </div>}
  </section>;
}

function ExpandedBattleField({ battle, hardcore, lastEvent }: { battle: ArenaBattle; hardcore: boolean; lastEvent?: BattleEvent }) {
  const parity = battleSideIndex(battle.playerSide || 'p1') % 2;
  const sides = battle.sides || [];
  const preview = battle.requestType === 'team' || battle.turn === 0 && sides.every(side => !side.actives.length);
  const effects = [battle.weather, ...(battle.fieldConditions || [])].filter(Boolean);
  return <div className="battle-field is-expanded" aria-label="Battle field" data-layout={battle.gameType} data-weather={battle.weather || 'clear'}>
    <div className="field-backdrop" aria-hidden /><div className="field-vignette" aria-hidden />
    <header className="layout-field-heading"><strong>{battle.gameType === 'freeforall' ? 'Free-for-all' : battle.gameType === 'multi' ? 'Multi battle' : 'Triples'}</strong><span>{preview ? sides.every(side => !side.team.length) ? 'Waiting for players' : 'Team preview' : `Turn ${battle.turn || '—'}`}</span></header>
    {(['far', 'near'] as const).map(half => {
      const owners = sides.filter(side => (battleSideIndex(side.id) % 2 === parity) === (half === 'near'));
      if (half === 'far') owners.reverse();
      return <div className={`layout-half is-${half}`} key={half}>
        {owners.map(owner => <LayoutSide key={owner.id} owner={owner} battle={battle} half={half} hardcore={hardcore} event={lastEvent} preview={preview} />)}
      </div>;
    })}
    {lastEvent?.label && <p className="layout-announcement" role="status">{lastEvent.label}</p>}
    {effects.length > 0 && <div className="layout-field-effects" role="group" aria-label="Field conditions">{effects.map(effect => <span key={effect}>{effect}</span>)}</div>}
  </div>;
}

export function BattleField({ battle, hardcore = false, lastEvent }: {
  battle: ArenaBattle;
  hardcore?: boolean;
  lastEvent?: BattleEvent;
}) {
  if ((battle.gameType === 'triples' || isFourPlayerBattle(battle.gameType)) && battle.sides?.length) {
    return <ExpandedBattleField battle={battle} hardcore={hardcore} lastEvent={lastEvent} />;
  }
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
          <RosterPips team={battle.opponentTeam} total={battle.opponentTeamSize} hidden={hardcore} label={`${farPlayer.name}'s team`} />
        </span>
        <strong className="field-turn">Turn {battle.turn || '—'}</strong>
      </header>

      {lastEvent?.label && (
        <p className="field-announce" key={lastEvent.at} role="status">
          {lastEvent.label}
        </p>
      )}

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
          <RosterPips team={battle.team} total={battle.teamSize} hidden={false} label="Your team" />
        </span>
      </footer>
    </div>
  );
}
