import type { Battle, Pokemon } from '@pkmn/client';
import type { ID } from '@pkmn/data';
import {
  buildMoveDeck,
  requestFlags,
  type ArenaBattle,
  type BattleRequest,
  type PokemonSet,
  type SideCondition,
} from '../compat/battle-adapter';
import { loadDex, type TypeName } from '../data/dex';

/**
 * The battle engine: `@pkmn/client` consumes raw protocol lines and maintains
 * complete battle state — switches, boosts, volatiles, hazards, formes,
 * doubles positions, timers — with the official client's semantics. We keep a
 * thin read-side projection into the view model our components already render,
 * and keep choice building (requests → /choose commands) ourselves.
 *
 * The engine depends on the dex, which is a lazy chunk, so the module loads
 * asynchronously. Battle rooms buffer raw lines until it is ready and then
 * replay them through a fresh Battle — the same flush pattern the dex load
 * already used.
 */

type EngineModule = {
  Battle: typeof Battle;
  createBattle: (player: string | null) => Battle;
};

let engineModule: EngineModule | null = null;
let loading: Promise<EngineModule> | null = null;
const listeners = new Set<() => void>();

export function loadEngine(): Promise<EngineModule> {
  if (engineModule) return Promise.resolve(engineModule);
  loading ??= (async () => {
    const [{ Battle: BattleClass }, { Generations }, { Dex }] = await Promise.all([
      import('@pkmn/client'),
      import('@pkmn/data'),
      import('@pkmn/dex'),
      loadDex(),
    ]);
    const gens = new Generations(Dex);
    engineModule = {
      Battle: BattleClass,
      createBattle: player => new BattleClass(gens, (player || null) as ID | null),
    };
    listeners.forEach(listener => listener());
    return engineModule;
  })();
  return loading;
}

export function isEngineReady() {
  return engineModule !== null;
}

export function onEngineReady(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Synchronous battle factory; null until the engine chunk resolves. */
export function createEngineBattle(player: string | null): Battle | null {
  if (!engineModule) return null;
  return engineModule.createBattle(player);
}

/** Feeds one raw protocol line (or a |request| line) into an engine battle. */
export function feedLine(battle: Battle, raw: string) {
  try {
    battle.add(raw);
  } catch {
    // A malformed or unrecognized line must never take the room down; the
    // engine simply doesn't advance for it.
  }
}

// ── Projection: engine state → view model ───────────────────────────────────

const STATUS_MAP: Record<string, PokemonSet['status']> = {
  brn: 'BRN', par: 'PAR', psn: 'PSN', tox: 'TOX', slp: 'SLP', frz: 'FRZ',
};

const titleCase = (id: string) =>
  id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, first => first.toUpperCase());

const conditionName = (battle: Battle, id: string): string => {
  const resolved = battle.get('conditions', id);
  return resolved?.name || titleCase(id);
};

const safeTypes = (pokemon: Pokemon): TypeName[] => {
  // The getter resolves the species in the battle's generation; a species the
  // loaded gen does not know (mods, future gens, a missing |gen| line) throws
  // deep inside the engine and must never take the room down.
  try {
    return [...pokemon.types] as TypeName[];
  } catch {
    return [];
  }
};

const projectPokemon = (
  battle: Battle,
  pokemon: Pokemon,
  slot: number,
  exactHpKnown: boolean
): PokemonSet => {
  const percent = pokemon.maxhp > 0 ? (pokemon.hp / pokemon.maxhp) * 100 : 0;
  const boosts = Object.fromEntries(
    Object.entries(pokemon.boosts).filter(([, stage]) => stage !== 0)
  ) as PokemonSet['boosts'];
  const volatiles = Object.keys(pokemon.volatiles).map(id => conditionName(battle, id));

  return {
    slot,
    name: pokemon.name || pokemon.speciesForme,
    species: pokemon.speciesForme,
    hp: Math.max(0, Math.min(100, percent)),
    currentHp: exactHpKnown ? pokemon.hp : undefined,
    maxHp: exactHpKnown ? pokemon.maxhp : undefined,
    status: pokemon.status ? STATUS_MAP[pokemon.status] : undefined,
    types: safeTypes(pokemon),
    level: pokemon.level,
    gender: pokemon.gender === 'M' || pokemon.gender === 'F' ? pokemon.gender : undefined,
    shiny: pokemon.shiny || undefined,
    terastallized: (pokemon.terastallized || undefined) as TypeName | undefined,
    boosts: boosts && Object.keys(boosts).length ? boosts : undefined,
    volatiles: volatiles.length ? volatiles : undefined,
    item: pokemon.item ? String(pokemon.item) : undefined,
    ability: pokemon.ability ? String(pokemon.ability) : undefined,
    active: pokemon.isActive(),
    fainted: pokemon.fainted,
  };
};

const projectSideConditions = (battle: Battle, side: Battle['p1']): SideCondition[] =>
  Object.entries(side.sideConditions).map(([id, condition]) => ({
    name: condition.name || conditionName(battle, id),
    layers: condition.level || 1,
  }));

export type EngineProjectionContext = {
  roomId: string;
  /** Our seat, when we are a player; null when spectating. */
  perspective: 'p1' | 'p2' | null;
  /** Set by the router from |win|/|tie| — the engine does not track it. */
  result?: { winner?: string; ended: boolean };
  lastRequest?: BattleRequest;
  waiting?: boolean;
  format?: string;
};

const FALLBACK: PokemonSet = {
  slot: 1, name: 'Waiting', species: 'substitute', hp: 100, active: true,
};

export function projectEngineBattle(battle: Battle, context: EngineProjectionContext): ArenaBattle {
  const ourSideId = context.perspective ?? 'p1';
  const ours = ourSideId === 'p2' ? battle.p2 : battle.p1;
  const theirs = ourSideId === 'p2' ? battle.p1 : battle.p2;
  const mode: ArenaBattle['mode'] = context.result?.ended ? 'ended' :
    context.perspective ? 'player' : 'spectator';
  // Exact HP is knowable whenever we held a seat — including after the battle
  // ends. Spectators get percentages throughout.
  const exactOurs = context.perspective !== null;

  const team = ours.team.map((pokemon, index) => projectPokemon(battle, pokemon, index + 1, exactOurs));
  const opponentTeam = theirs.team.map((pokemon, index) => projectPokemon(battle, pokemon, index + 1, false));

  const actives = ours.active
    .map((pokemon, index) => pokemon ? projectPokemon(battle, pokemon, index + 1, exactOurs) : null)
    .filter((pokemon): pokemon is PokemonSet => pokemon !== null);
  const opponentActives = theirs.active
    .map((pokemon, index) => pokemon ? projectPokemon(battle, pokemon, index + 1, false) : null)
    .filter((pokemon): pokemon is PokemonSet => pokemon !== null);

  const activePokemon = ours.active.find(Boolean);
  const opponentActive = theirs.active.find(Boolean);

  const active = activePokemon ?
    projectPokemon(battle, activePokemon, (activePokemon.slot ?? 0) + 1, exactOurs) :
    team.find(pokemon => pokemon.active) || team[0] || FALLBACK;
  const opposing = opponentActive ?
    projectPokemon(battle, opponentActive, (opponentActive.slot ?? 0) + 1, false) :
    opponentTeam.find(pokemon => pokemon.active) || opponentTeam[0] || { ...FALLBACK, name: 'Opponent' };

  const flags = context.lastRequest ? requestFlags(context.lastRequest) : undefined;
  const moves = context.lastRequest ?
    buildMoveDeck(context.lastRequest, opposing.terastallized ? [opposing.terastallized] : opposing.types, context.format) :
    [];

  const fieldConditions = [
    battle.field.terrain ? String(battle.field.terrain) : '',
    ...Object.keys(battle.field.pseudoWeather).map(id => conditionName(battle, id)),
  ].filter(Boolean);

  return {
    id: context.roomId,
    format: context.format || battle.tier || 'Battle',
    turn: battle.turn,
    playerSide: context.perspective ?? undefined,
    p1: { name: battle.p1.name || 'Player 1', rating: Number(battle.p1.rating) || 0 },
    p2: { name: battle.p2.name || 'Player 2', rating: Number(battle.p2.rating) || 0 },
    active,
    opponentActive: opposing,
    actives: actives.length ? actives : undefined,
    opponentActives: opponentActives.length ? opponentActives : undefined,
    team,
    opponentTeam,
    weather: battle.field.weather ? String(battle.field.weather) : undefined,
    fieldConditions: fieldConditions.length ? fieldConditions : undefined,
    sideConditions: projectSideConditions(battle, ours),
    opponentSideConditions: projectSideConditions(battle, theirs),
    winner: context.result?.winner,
    ended: context.result?.ended,
    timerOn: battle.kickingInactive !== 'off' && battle.kickingInactive !== 0,
    moves,
    log: [],
    chat: [],
    rqid: context.lastRequest?.rqid,
    requestType: flags?.requestType,
    waiting: context.waiting ?? !!context.lastRequest?.wait,
    noCancel: flags?.noCancel,
    trapped: flags?.trapped,
    maybeTrapped: flags?.maybeTrapped,
    targetable: flags?.targetable,
    teamPreviewSize: flags?.teamPreviewSize,
    mode,
  };
}

/**
 * Folds a complete log through a fresh engine battle — the replay viewer and
 * the fixture tests use this. Perspective works like the live path: a
 * username matching |player| yields that seat's view.
 */
export function projectEngineLog(
  lines: string[],
  options: { roomId?: string; username?: string; upTo?: number } = {}
): ArenaBattle | null {
  if (!engineModule) return null;
  const end = options.upTo === undefined ? lines.length : Math.min(options.upTo + 1, lines.length);

  const battle = engineModule.createBattle(null);
  let perspective: 'p1' | 'p2' | null = null;
  let result: EngineProjectionContext['result'];
  let lastRequest: BattleRequest | undefined;
  let format: string | undefined;
  const userId = (options.username || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  for (let index = 0; index < end; index++) {
    const raw = lines[index];
    if (!raw) continue;
    const parts = raw.split('|');
    const command = parts[1] || '';

    if (command === 'player' && userId) {
      const side = parts[2] === 'p2' ? 'p2' : 'p1';
      const name = (parts[3] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (name && name === userId) perspective = side;
    }
    if (command === 'tier') format = parts[2] || format;
    if (command === 'win') result = { winner: parts[2], ended: true };
    if (command === 'tie') result = { ended: true };
    if (command === 'request') {
      const rawRequest = parts.slice(2).join('|');
      if (rawRequest) {
        try {
          lastRequest = JSON.parse(rawRequest) as BattleRequest;
          if (lastRequest.side?.id === 'p1' || lastRequest.side?.id === 'p2') {
            perspective = lastRequest.side.id;
          }
        } catch { /* not a valid request payload */ }
      }
    }
    feedLine(battle, raw);
  }

  return projectEngineBattle(battle, {
    roomId: options.roomId || 'replay',
    perspective,
    result,
    lastRequest,
    format,
  });
}
