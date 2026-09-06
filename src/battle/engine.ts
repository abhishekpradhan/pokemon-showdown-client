import type { Battle, Pokemon } from '@pkmn/client';
import type { ID } from '@pkmn/data';
import {
  buildMoveDeck,
  battleSupport,
  battleSideIndex,
  isBattleSideID,
  isBattleRequest,
  isFourPlayerBattle,
  defensiveTypes,
  normalizeBattleRequest,
  requestFlags,
  type ArenaBattle,
  type ArenaBattleSide,
  type BattleSideID,
  type BattleRequest,
  type BattleRequestPokemon,
  type PokemonSet,
  type SideCondition,
} from '../compat/battle-adapter';
import { loadDex, type TypeName } from '../data/dex';
import { describeBattleLine } from '../compat/battle-text';

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
  })().catch(error => { loading = null; throw error; });
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
const engineWarnings = new WeakMap<Battle, string>();
const exactHealthSides = new WeakMap<Battle, Set<string>>();
const privateRosters = new WeakMap<Battle, Map<string, BattleRequestPokemon[]>>();

/**
 * @pkmn/client 0.7.3 initializes p3/p4 with off-by-one side numbers and
 * aliases their active arrays to p1/p2. A private request then replaces only
 * one alias. Reconcile those arrays by Pokémon owner after request refreshes,
 * preserving canonical positions (p1a/p2a/p3b/p4b) and the engine's half model.
 */
function repairFourPlayerSides(battle: Battle, clear = false) {
  if (!isFourPlayerBattle(battle.gameType) || !battle.p3 || !battle.p4) return;
  battle.sides.splice(2, battle.sides.length - 2, battle.p3, battle.p4);
  const all = battle.sides.flatMap(side => side.active);
  const halves: Array<Array<Pokemon | null>> = [[null, null], [null, null]];
  for (const [index, side] of battle.sides.entries()) {
    (side as unknown as { n: number }).n = index;
    const pokemon = clear ? null : [...side.active, ...all].find(pokemon => pokemon?.side === side && !pokemon.fainted) || null;
    const slot = Math.floor(index / 2);
    if (pokemon) { pokemon.slot = slot; halves[index % 2][slot] = pokemon; }
  }
  for (const [index, side] of battle.sides.entries()) side.active = halves[index % 2];
}

export function feedLine(battle: Battle, raw: string): boolean {
  try {
    // Upkeep iterates all four sides; the engine's shared half arrays would
    // otherwise increment Toxic counters twice for each active Pokémon.
    if (raw.split('|')[1] === 'upkeep' && isFourPlayerBattle(battle.gameType) && battle.p3 && battle.p4) {
      battle.p3.active = []; battle.p4.active = [];
    }
    battle.add(raw);
    repairFourPlayerSides(battle, raw.split('|')[1] === 'start');
    if (raw.startsWith('|request|') && battle.request?.side?.id) {
      const sides = exactHealthSides.get(battle) || new Set<string>();
      sides.add(battle.request.side.id);
      exactHealthSides.set(battle, sides);
      const rosters = privateRosters.get(battle) || new Map<string, BattleRequestPokemon[]>();
      rosters.set(battle.request.side.id, battle.request.side.pokemon as BattleRequestPokemon[]);
      const request = battle.request;
      // Partner data is deliberately disclosed by the server in multi only.
      // Feed it as a roster update; do not synthesize or expose it in FFA.
      const payload = JSON.parse(raw.slice('|request|'.length)) as BattleRequest;
      const ownId = request.side.id;
      const allyId = payload.ally?.id;
      if (battle.gameType === 'multi' && isBattleSideID(ownId) && isBattleSideID(allyId) &&
        battleSideIndex(allyId) === (battleSideIndex(ownId) ^ 2) && payload.ally?.pokemon && isBattleRequest({ side: payload.ally })) {
        try {
          battle.add(`|request|${JSON.stringify({ side: payload.ally, forceSwitch: [false] })}`);
          if (battle.request?.side) {
            rosters.set(allyId, battle.request.side.pokemon as BattleRequestPokemon[]);
            sides.add(allyId);
          }
        } finally {
          battle.request = request;
          repairFourPlayerSides(battle);
        }
      }
      privateRosters.set(battle, rosters);
    }
    return true;
  } catch {
    // Keep credentials/private request details out of diagnostics.
    engineWarnings.set(battle, `Battle state could not process ${raw.split('|')[1] || 'a protocol event'}. Rejoin to synchronize.`);
    return false;
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
  exactHpKnown: boolean,
  serverPokemon?: BattleRequestPokemon,
): PokemonSet => {
  const percent = pokemon.maxhp > 0 ? (pokemon.hp / pokemon.maxhp) * 100 : pokemon.fainted ? 0 : 100;
  const boosts = Object.fromEntries(
    Object.entries(pokemon.boosts).filter(([, stage]) => stage !== 0)
  ) as PokemonSet['boosts'];
  const volatiles = Object.keys(pokemon.volatiles).map(id => conditionName(battle, id));
  let speedRange: [number, number] | undefined;
  let effectiveAbility: string | undefined;
  let grounded: boolean | undefined;
  try {
    effectiveAbility = pokemon.effectiveAbility();
    grounded = pokemon.isGrounded();
    const base = pokemon.species.baseStats.spe;
    const level = pokemon.level;
    speedRange = battle.gen.num <= 2 ?
      [Math.floor(2 * base * level / 100) + 5, Math.floor((2 * (base + 15) + 63) * level / 100) + 5] :
      [Math.floor((Math.floor(2 * base * level / 100) + 5) * 0.9), Math.floor((Math.floor((2 * base + 31 + 63) * level / 100) + 5) * 1.1)];
  } catch { /* Unknown custom species: no invented range. */ }

  return {
    slot,
    name: pokemon.name || pokemon.speciesForme,
    species: pokemon.speciesForme,
    hp: Math.max(0, Math.min(100, percent)),
    hpKnown: pokemon.maxhp > 0 || pokemon.fainted,
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
    item: pokemon.item ? battle.get('items', pokemon.item).name : undefined,
    lastItem: pokemon.lastItem ? battle.get('items', pokemon.lastItem).name : undefined,
    ability: pokemon.ability ? battle.get('abilities', pokemon.ability).name : undefined,
    effectiveAbility,
    grounded,
    itemSuppressed: !!(battle.field.hasPseudoWeather('magicroom' as ID) || pokemon.volatiles.embargo || effectiveAbility === 'klutz'),
    stats: exactHpKnown ? serverPokemon?.stats : undefined,
    speedRange,
    knownMoves: pokemon.moveSlots.map(move => ({ name: move.name, used: move.ppUsed, pp: 'pp' in move ? move.pp : undefined, maxpp: 'maxpp' in move ? move.maxpp : undefined })),
    counters: [pokemon.statusState.toxicTurns ? `Toxic: ${pokemon.statusState.toxicTurns} turns` : '',
      pokemon.statusState.sleepTurns ? `Sleep: ${pokemon.statusState.sleepTurns} turns` : '',
      ...Object.entries(pokemon.volatiles).flatMap(([id, effect]) => typeof effect.duration === 'number' ? [`${conditionName(battle, id)}: ${effect.duration} turns`] : []),
    ].filter(Boolean),
    active: pokemon.isActive(),
    fainted: pokemon.fainted,
  };
};

const projectSideConditions = (battle: Battle, side: Battle['p1']): SideCondition[] =>
  Object.entries(side.sideConditions).map(([id, condition]) => ({
    name: condition.name || conditionName(battle, id),
    layers: condition.level || 1,
    duration: condition.maxDuration ? [condition.minDuration, condition.maxDuration] : undefined,
  }));

export type EngineProjectionContext = {
  roomId: string;
  /** Our seat, when we are a player; null when spectating. */
  perspective: BattleSideID | null;
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
  const ourIndex = battleSideIndex(ourSideId);
  const ours = battle.sides[ourIndex] || battle.p1;
  const theirs = battle.sides[ourIndex ^ 1] || battle.p2;
  const mode: ArenaBattle['mode'] = context.result?.ended ? 'ended' :
    context.perspective ? 'player' : 'spectator';
  // Exact HP is knowable whenever we held a seat — including after the battle
  // ends. Spectators get percentages throughout.
  const exactOurs = context.perspective !== null && (exactHealthSides.get(battle)?.has(ourSideId) ||
    context.lastRequest?.side?.id === ourSideId || battle.request?.side?.id === ourSideId);

  const request = context.lastRequest ? normalizeBattleRequest({ ...context.lastRequest, gameType: battle.gameType, teamPreviewCount: battle.teamPreviewCount }) : undefined;
  const four = isFourPlayerBattle(battle.gameType);
  const sides: ArenaBattleSide[] = battle.sides.map((side, index) => {
    const id = `p${index + 1}` as BattleSideID;
    const roster = id === ourSideId ? request?.side?.pokemon || privateRosters.get(battle)?.get(id) : privateRosters.get(battle)?.get(id);
    const exact = id === ourSideId ? exactOurs : context.perspective !== null && !!exactHealthSides.get(battle)?.has(id);
    const privatePokemon = (pokemon: Pokemon) => roster?.find(entry => entry.ident === `${id}: ${pokemon.name}`);
    const project = (pokemon: Pokemon, slot: number) => ({ ...projectPokemon(battle, pokemon, slot, exact, privatePokemon(pokemon)), sideId: id });
    const team = side.team.map((pokemon, slot) => project(pokemon, slot + 1));
    const actives = side.active.flatMap((pokemon, slot) => pokemon && pokemon.side === side ? [project(pokemon, four ? 1 : slot + 1)] : []);
    // Multi shares hazards/screens by team; keep one engine owner so timers
    // are not decremented twice by shared mutable condition objects.
    const partner = battle.gameType === 'multi' ? battle.sides[index ^ 2] : undefined;
    const conditions = projectSideConditions(battle, side);
    if (partner) for (const condition of projectSideConditions(battle, partner)) {
      if (!conditions.some(entry => entry.name === condition.name)) conditions.push(condition);
    }
    return { id, name: side.name || `Player ${index + 1}`, rating: Number(side.rating) || 0,
      team, actives, teamSize: Math.max(side.totalPokemon, team.length), conditions };
  });
  const ownView = sides[ourIndex] || sides[0];
  const opponentView = sides[ourIndex ^ 1] || sides[1];
  const { team, actives } = ownView;
  const opponentTeam = opponentView.team;
  const opponentActives = opponentView.actives;
  const active = actives[0] || team.find(pokemon => pokemon.active) || team[0] || FALLBACK;
  const opposing = opponentActives[0] || opponentTeam.find(pokemon => pokemon.active) || opponentTeam[0] || { ...FALLBACK, name: 'Opponent' };

  const flags = request ? requestFlags(request) : undefined;
  const moves = request ?
    buildMoveDeck(request, defensiveTypes(opposing), `gen${battle.gen.num}`, 0, opposing, active, battle.field.weather) :
    [];

  const fieldConditions = [
    battle.field.terrain ? String(battle.field.terrain) : '',
    ...Object.keys(battle.field.pseudoWeather).map(id => conditionName(battle, id)),
  ].filter(Boolean);

  return {
    id: context.roomId,
    format: context.format || battle.tier || 'Battle',
    gameType: battle.gameType,
    generation: battle.gen.num,
    teamPreviewCount: battle.teamPreviewCount,
    teamSize: Math.max(ours.totalPokemon, team.length),
    opponentTeamSize: Math.max(theirs.totalPokemon, opponentTeam.length),
    supportReason: battleSupport(context.format, battle.gameType).reason,
    engineWarning: engineWarnings.get(battle),
    turn: battle.turn,
    playerSide: context.perspective ?? undefined,
    p1: { name: battle.p1.name || 'Player 1', rating: Number(battle.p1.rating) || 0 },
    p2: { name: battle.p2.name || 'Player 2', rating: Number(battle.p2.rating) || 0 },
    p3: sides[2] ? { name: sides[2].name, rating: sides[2].rating } : undefined,
    p4: sides[3] ? { name: sides[3].name, rating: sides[3].rating } : undefined,
    sides,
    active,
    opponentActive: opposing,
    actives: actives.length ? actives : undefined,
    opponentActives: opponentActives.length ? opponentActives : undefined,
    team,
    opponentTeam,
    weather: battle.field.weather ? String(battle.field.weather) : undefined,
    fieldConditions: fieldConditions.length ? fieldConditions : undefined,
    sideConditions: ownView.conditions,
    opponentSideConditions: opponentView.conditions,
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
  let perspective: BattleSideID | null = null;
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
      const side = isBattleSideID(parts[2]) ? parts[2] : null;
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
          if (isBattleSideID(lastRequest.side?.id)) {
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

export type BattleHistoryPoint = { line: number; turn: number; label: string; battle: ArenaBattle };

/** Incremental history projection: new frames never replay the existing prefix. */
export function createBattleHistory(roomId: string, username = '', options: { turnsOnly?: boolean; maxPoints?: number } = {}) {
  let battle = createEngineBattle(null);
  if (!battle) return null;
  let consumed = 0;
  let lastLine = '';
  let context: EngineProjectionContext = { roomId, perspective: null };
  let points: BattleHistoryPoint[] = [];
  const userId = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  return {
    synchronize(lines: string[]): readonly BattleHistoryPoint[] {
      if (lines.length < consumed || consumed > 0 && lines[consumed - 1] !== lastLine) {
        battle = createEngineBattle(null)!;
        consumed = 0;
        points = [];
        context = { roomId, perspective: null };
      }
      for (let index = consumed; index < lines.length; index++) {
        const raw = lines[index];
        const [, command = '', ...args] = raw.split('|');
        if (command === 'player' && isBattleSideID(args[0]) && userId && args[1]?.toLowerCase().replace(/[^a-z0-9]/g, '') === userId) context.perspective = args[0];
        if (command === 'tier') context.format = args[0];
        if (command === 'win') context.result = { winner: args[0], ended: true };
        if (command === 'tie') context.result = { ended: true };
        if (command === 'request') {
          try {
            context.lastRequest = JSON.parse(args.join('|')) as BattleRequest;
            if (isBattleSideID(context.lastRequest.side?.id)) context.perspective = context.lastRequest.side.id;
          } catch { /* The live router surfaces malformed request state. */ }
        }
        feedLine(battle!, raw);
        const capture = options.turnsOnly ? ['start', 'turn', 'win', 'tie'].includes(command) || index === lines.length - 1 :
          ['turn', 'move', 'switch', 'drag', 'faint', 'win', 'tie', 'cant'].includes(command) || command.startsWith('-');
        if (capture) {
          points.push({ line: index, turn: battle!.turn, label: describeBattleLine({ command, args }), battle: projectEngineBattle(battle!, context) });
        }
      }
      consumed = lines.length;
      lastLine = lines.at(-1) || '';
      // Historical snapshots are view data, never needed to maintain the live
      // engine. Bound them independently of the downloadable protocol log.
      const maxPoints = Math.max(1, Math.min(5_000, options.maxPoints || 2_000));
      if (points.length > maxPoints) points = points.slice(-maxPoints);
      return points;
    },
  };
}

/** A spectator can change sides without changing what information is known. */
export function flipBattleView(battle: ArenaBattle): ArenaBattle {
  if (battle.sides?.length) {
    const current = battleSideIndex(battle.playerSide || 'p1');
    const index = isFourPlayerBattle(battle.gameType) ? (current + 1) % 4 : current ^ 1;
    const own = battle.sides[index];
    const foe = battle.sides[index ^ 1];
    if (own && foe) return { ...battle, playerSide: own.id,
      active: own.actives[0] || own.team[0] || FALLBACK, opponentActive: foe.actives[0] || foe.team[0] || FALLBACK,
      actives: own.actives, opponentActives: foe.actives, team: own.team, opponentTeam: foe.team,
      teamSize: own.teamSize, opponentTeamSize: foe.teamSize, sideConditions: own.conditions, opponentSideConditions: foe.conditions };
  }
  const nextSide = `p${(battleSideIndex(battle.playerSide || 'p1') ^ 1) + 1}` as BattleSideID;
  return { ...battle, playerSide: nextSide,
    active: battle.opponentActive, opponentActive: battle.active,
    actives: battle.opponentActives, opponentActives: battle.actives,
    team: battle.opponentTeam, opponentTeam: battle.team,
    teamSize: battle.opponentTeamSize, opponentTeamSize: battle.teamSize,
    sideConditions: battle.opponentSideConditions, opponentSideConditions: battle.sideConditions,
  };
}
