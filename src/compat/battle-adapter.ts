import {
  DEFAULT_GEN,
  effectiveness,
  formatEffectiveness,
  genFromFormat,
  getMove,
  getSpecies,
  type TypeName,
} from '../data/dex';

export type PokemonSet = {
  slot: number;
  name: string;
  /** Display species, e.g. `Pikachu-Original`. Sprite lookup uses this. */
  species: string;
  /** Percentage, always known. The opponent's exact HP never is. */
  hp: number;
  /** Exact HP, known only for your own side (the server sends `48/187`). */
  currentHp?: number;
  maxHp?: number;
  status?: 'BRN' | 'PAR' | 'PSN' | 'TOX' | 'SLP' | 'FRZ';
  types?: TypeName[];
  level?: number;
  gender?: 'M' | 'F';
  shiny?: boolean;
  terastallized?: TypeName;
  /** Stat stages, -6..+6. Absent keys are unmodified. */
  boosts?: Partial<Record<BoostId, number>>;
  /** Active volatiles by display name, e.g. `Substitute`, `Leech Seed`. */
  volatiles?: string[];
  item?: string;
  ability?: string;
  active?: boolean;
  fainted?: boolean;
};

export type BoostId = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion';

export const BOOST_LABELS: Record<BoostId, string> = {
  atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
  accuracy: 'Acc', evasion: 'Eva',
};

/** Entry hazards and screens, tracked per side with their layer count. */
export type SideCondition = { name: string; layers: number };

export type BattleRoomMode = 'player' | 'spectator' | 'waiting' | 'ended';

export type BattleChoice = {
  slot: number;
  activeIndex?: number;
  name: string;
  type: TypeName;
  /** `11/16`. */
  pp: string;
  ppLeft?: number;
  ppMax?: number;
  cmd: string;
  /** Damage multiplier against the current opposing active, when known. */
  effectiveness?: string;
  category?: 'Physical' | 'Special' | 'Status';
  basePower?: number;
  accuracy?: number | true;
  description?: string;
  disabled?: boolean;
  target?: string;
  requiresTarget?: boolean;
  targetOptions?: number[];
  canMegaEvo?: boolean;
  canUltraBurst?: boolean;
  canZMove?: boolean;
  canDynamax?: boolean;
  canTerastallize?: boolean;
};

export type ArenaBattle = {
  id: string;
  format: string;
  turn: number;
  playerSide?: 'p1' | 'p2';
  p1: { name: string; rating: number };
  p2: { name: string; rating: number };
  active: PokemonSet;
  opponentActive: PokemonSet;
  team: PokemonSet[];
  opponentTeam: PokemonSet[];
  weather?: string;
  fieldConditions?: string[];
  /** Hazards and screens on your side and the opponent's. */
  sideConditions?: SideCondition[];
  opponentSideConditions?: SideCondition[];
  winner?: string;
  ended?: boolean;
  timerOn?: boolean;
  moves: BattleChoice[];
  log: string[];
  chat: { user: string; message: string }[];
  rqid?: number;
  requestType?: 'move' | 'switch' | 'team' | 'wait';
  waiting?: boolean;
  noCancel?: boolean;
  trapped?: boolean;
  maybeTrapped?: boolean;
  targetable?: boolean;
  teamPreviewSize?: number;
  mode?: BattleRoomMode;
  choiceError?: string;
  choiceDraft?: BattleChoiceDraft;
};

export type BattleRequestMove = {
  move: string;
  id?: string;
  type?: BattleChoice['type'];
  pp?: number;
  maxpp?: number;
  target?: string;
  disabled?: boolean;
};

export type BattleRequestSpecialMove = BattleRequestMove & {
  name?: string;
};

export type BattleRequestPokemon = {
  ident: string;
  details: string;
  condition: string;
  active?: boolean;
  stats?: Record<string, number>;
  moves?: string[];
  item?: string;
  ability?: string;
  baseAbility?: string;
};

export type BattleRequest = {
  rqid?: number;
  wait?: boolean;
  forceSwitch?: boolean | boolean[];
  teamPreview?: boolean;
  side?: {
    id?: string;
    name?: string;
    pokemon?: BattleRequestPokemon[];
  };
  active?: Array<{
    moves?: BattleRequestMove[];
    maxMoves?: BattleRequestSpecialMove[] | { maxMoves?: BattleRequestSpecialMove[]; gigantamax?: boolean };
    zMoves?: Array<BattleRequestSpecialMove | null>;
    trapped?: boolean;
    maybeTrapped?: boolean;
    maybeDisabled?: boolean;
    canMegaEvo?: boolean;
    canUltraBurst?: boolean;
    canZMove?: Array<BattleRequestSpecialMove | null> | boolean;
    canDynamax?: boolean;
    canTerastallize?: string;
  } | null>;
  noCancel?: boolean;
  chosenTeamSize?: number;
  maxChosenTeamSize?: number;
  requestType?: 'move' | 'switch' | 'team' | 'wait';
  targetable?: boolean;
};

export type BattleChoiceState =
  | { kind: 'move'; slot: number; activeIndex?: number; target?: number; mega?: boolean; ultra?: boolean; z?: boolean; max?: boolean; tera?: boolean }
  | { kind: 'switch'; slot: number }
  | { kind: 'team'; order: number[] }
  | { kind: 'pass' }
  | { kind: 'shift' };

export type BattleChoiceDraft = {
  choices: string[];
  pendingMove?: BattleChoiceState & { kind: 'move' };
};

export type BattleChoiceValidation = {
  ok: boolean;
  error?: string;
};

export type BattleCommandResult = BattleChoiceValidation & {
  complete: boolean;
  command?: string;
  draft: BattleChoiceDraft;
  session: BattleChoiceSession;
  message?: string;
};

export type BattleDecisionState = {
  roomId: string;
  mode: BattleRoomMode;
  requestType?: ArenaBattle['requestType'];
  requestLength: number;
  noCancel: boolean;
  waiting: boolean;
  targetable: boolean;
  draft: BattleChoiceDraft;
  error?: string;
};

export type BattleRequestNormalized = Omit<BattleRequest, 'active' | 'forceSwitch' | 'requestType' | 'noCancel' | 'targetable'> & {
  requestType: 'move' | 'switch' | 'team' | 'wait';
  forceSwitch?: boolean[];
  active?: Array<({
    moves?: BattleRequestMove[];
    maxMoves?: BattleRequestSpecialMove[];
    zMoves?: Array<BattleRequestSpecialMove | null>;
    trapped?: boolean;
    maybeTrapped?: boolean;
    maybeDisabled?: boolean;
    canMegaEvo?: boolean;
    canUltraBurst?: boolean;
    canZMove?: Array<BattleRequestSpecialMove | null> | boolean;
    canDynamax?: boolean;
    canTerastallize?: string;
  } | null)>;
  chosenTeamSize?: number;
  noCancel: boolean;
  targetable: boolean;
};

export type BattleChoiceSession = {
  request: BattleRequestNormalized;
  draft: BattleChoiceDraft;
  noCancel: boolean;
  alreadySwitchingIn: number[];
  alreadyMega: boolean;
  alreadyMax: boolean;
  alreadyZ: boolean;
  alreadyTera: boolean;
};

export type ChoiceBuilderAdapter = {
  request: BattleRequest;
  requestType: ArenaBattle['requestType'];
  requestLength: number;
  noCancel: boolean;
  build: (choice: BattleChoiceState) => string;
};

/**
 * Development fixture. Species names are real dex names so sprites, types and
 * effectiveness resolve exactly as they do in a live battle.
 */
export const demoBattle: ArenaBattle = {
  id: 'demo-gen9ou',
  format: 'gen9ou',
  turn: 12,
  playerSide: 'p1',
  p1: { name: 'You', rating: 1516 },
  p2: { name: 'Rival', rating: 1498 },
  active: {
    slot: 1, name: 'Iron Valiant', species: 'Iron Valiant', hp: 72,
    currentHp: 227, maxHp: 315, types: ['Fairy', 'Fighting'], level: 100, active: true,
  },
  opponentActive: {
    slot: 1, name: 'Great Tusk', species: 'Great Tusk', hp: 44,
    types: ['Ground', 'Fighting'], level: 100, active: true,
  },
  team: [
    { slot: 1, name: 'Iron Valiant', species: 'Iron Valiant', hp: 72, currentHp: 227, maxHp: 315, types: ['Fairy', 'Fighting'], active: true },
    { slot: 2, name: 'Dragapult', species: 'Dragapult', hp: 100, currentHp: 301, maxHp: 301, types: ['Dragon', 'Ghost'] },
    { slot: 3, name: 'Kingambit', species: 'Kingambit', hp: 64, currentHp: 214, maxHp: 334, types: ['Dark', 'Steel'], status: 'BRN' },
    { slot: 4, name: 'Rotom-Wash', species: 'Rotom-Wash', hp: 38, currentHp: 107, maxHp: 281, types: ['Electric', 'Water'] },
    { slot: 5, name: 'Amoonguss', species: 'Amoonguss', hp: 0, currentHp: 0, maxHp: 404, types: ['Grass', 'Poison'], fainted: true },
    { slot: 6, name: 'Heatran', species: 'Heatran', hp: 88, currentHp: 316, maxHp: 359, types: ['Fire', 'Steel'] },
  ],
  opponentTeam: [
    { slot: 1, name: 'Great Tusk', species: 'Great Tusk', hp: 44, types: ['Ground', 'Fighting'], active: true },
    { slot: 2, name: 'Gholdengo', species: 'Gholdengo', hp: 91, types: ['Steel', 'Ghost'] },
    { slot: 3, name: 'Samurott-Hisui', species: 'Samurott-Hisui', hp: 0, types: ['Water', 'Dark'], fainted: true },
    { slot: 4, name: 'Dragonite', species: 'Dragonite', hp: 100, types: ['Dragon', 'Flying'] },
    { slot: 5, name: 'Slowking-Galar', species: 'Slowking-Galar', hp: 57, types: ['Poison', 'Psychic'], status: 'PAR' },
    { slot: 6, name: 'Enamorus', species: 'Enamorus', hp: 84, types: ['Fairy', 'Flying'] },
  ],
  weather: 'Sandstorm',
  moves: [
    { slot: 1, name: 'Moonblast', type: 'Fairy', pp: '11/16', ppLeft: 11, ppMax: 16, cmd: '/choose move 1', effectiveness: '2x', category: 'Special', basePower: 95, accuracy: 100 },
    { slot: 2, name: 'Close Combat', type: 'Fighting', pp: '7/8', ppLeft: 7, ppMax: 8, cmd: '/choose move 2', effectiveness: '1x', category: 'Physical', basePower: 120, accuracy: 100 },
    { slot: 3, name: 'Knock Off', type: 'Dark', pp: '15/24', ppLeft: 15, ppMax: 24, cmd: '/choose move 3', effectiveness: '½x', category: 'Physical', basePower: 65, accuracy: 100 },
    { slot: 4, name: 'Encore', type: 'Normal', pp: '2/8', ppLeft: 2, ppMax: 8, cmd: '/choose move 4', category: 'Status', accuracy: 100 },
  ],
  requestType: 'move',
  mode: 'player',
  log: [
    'Turn 12 started.',
    'Pointed stones dug into Great Tusk.',
    'Iron Valiant awaits your command.',
  ],
  chat: [
    { user: 'system', message: 'Rated battle started.' },
    { user: 'spectator', message: 'clean opening position' },
  ],
};

export const emptyBattle: ArenaBattle = {
  id: 'pending',
  format: 'Battle',
  turn: 0,
  p1: { name: 'Player 1', rating: 0 },
  p2: { name: 'Player 2', rating: 0 },
  active: { slot: 1, name: 'Waiting', species: 'missingno', hp: 100, active: true },
  opponentActive: { slot: 1, name: 'Opponent', species: 'missingno', hp: 100, active: true },
  team: [],
  opponentTeam: [],
  moves: [],
  log: ['Waiting for battle data.'],
  chat: [],
  requestType: 'wait',
  waiting: true,
  mode: 'waiting',
};

const statusFromCondition = (condition: string): PokemonSet['status'] => {
  if (condition.includes(' brn')) return 'BRN';
  if (condition.includes(' par')) return 'PAR';
  if (condition.includes(' tox')) return 'TOX';
  if (condition.includes(' psn')) return 'PSN';
  if (condition.includes(' slp')) return 'SLP';
  if (condition.includes(' frz')) return 'FRZ';
  return undefined;
};

const idToName = (id: string) => id
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[-_]/g, ' ')
  .replace(/\b\w/g, letter => letter.toUpperCase());

const speciesFromDetails = (details: string) => details.split(',')[0]?.trim() || 'Pokemon';

const speciesId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Parses the extra fields of a `details` string (`Pikachu, L80, F, shiny`).
 * Order is not guaranteed beyond the species coming first.
 */
export function parseDetails(details: string, generation = DEFAULT_GEN) {
  const [rawSpecies, ...rest] = details.split(',').map(part => part.trim());
  const species = rawSpecies || 'Pokemon';
  let level: number | undefined;
  let gender: 'M' | 'F' | undefined;
  let shiny = false;

  for (const part of rest) {
    if (/^L\d+$/i.test(part)) level = Number(part.slice(1));
    else if (part === 'M' || part === 'F') gender = part;
    else if (part === 'shiny') shiny = true;
  }

  return {
    species,
    level,
    gender,
    shiny,
    types: (getSpecies(species, generation)?.types as TypeName[] | undefined),
  };
}

export type ParsedCondition = {
  hp: number;
  currentHp?: number;
  maxHp?: number;
  status?: PokemonSet['status'];
  fainted: boolean;
};

/**
 * Parses a `condition` string. Your own side reports exact HP (`155/281`);
 * the opponent's is a percentage (`64/100`), so only the ratio is meaningful
 * there.
 */
export function parseCondition(condition: string): ParsedCondition {
  const raw = (condition || '').trim();
  if (!raw || raw === '0 fnt' || raw.startsWith('0 ')) {
    return { hp: 0, currentHp: 0, fainted: true, status: statusFromCondition(raw) };
  }

  const [hpPart = '', ...statusParts] = raw.split(' ');
  const status = statusFromCondition(` ${statusParts.join(' ')}`);

  if (hpPart.includes('/')) {
    const [current, max] = hpPart.split('/').map(Number);
    if (Number.isFinite(current) && Number.isFinite(max) && max > 0) {
      return {
        hp: Math.max(0, Math.min(100, (current / max) * 100)),
        currentHp: current,
        maxHp: max,
        status,
        fainted: current <= 0,
      };
    }
  }

  const numeric = Number(hpPart);
  const hp = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 100;
  return { hp, status, fainted: hp <= 0 };
}

/** Percentage form, kept for call sites that only render a bar. */
export function parseHpPercent(condition: string) {
  return Math.round(parseCondition(condition).hp);
}

export function requestType(request?: BattleRequest | null): ArenaBattle['requestType'] {
  if (!request) return undefined;
  if (request.requestType) return request.requestType;
  if (request.wait) return 'wait';
  if (request.teamPreview) return 'team';
  if (request.forceSwitch) return 'switch';
  return 'move';
}

const canChooseTarget = (target?: string) => ['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe'].includes(target || '');

const defaultTargetOptions = (target?: string): number[] => {
  if (target === 'adjacentAlly' || target === 'adjacentAllyOrSelf') return [-1, 1];
  if (target === 'any') return [-2, -1, 1, 2];
  if (target === 'normal' || target === 'adjacentFoe') return [-1, -2];
  return [];
};

const normalizeSpecialMoves = (active: NonNullable<BattleRequest['active']>[number]) => {
  if (!active || !active.maxMoves) return [];
  if (Array.isArray(active.maxMoves)) return active.maxMoves;
  return active.maxMoves.maxMoves || [];
};

export function normalizeBattleRequest(request: BattleRequest, previousBattle?: ArenaBattle): BattleRequestNormalized {
  const normalizedType = requestType(request) || 'wait';
  const active = request.active?.map(entry => {
    if (!entry) return null;
    const moves = (entry.moves || []).map(move => ({
      ...move,
      id: move.id || speciesId(move.move || ''),
    }));
    const maxMoves: BattleRequestSpecialMove[] = normalizeSpecialMoves(entry).map(move => ({
      ...move,
      move: move.move || move.name || 'Move',
      id: move.id || speciesId(move.move || move.name || ''),
    }));
    const zMoves: Array<BattleRequestSpecialMove | null> | undefined = (Array.isArray(entry.canZMove) ? entry.canZMove : entry.zMoves)?.map(move => move ? ({
      ...move,
      move: move.move || move.name || 'Move',
      id: move.id || speciesId(move.move || move.name || ''),
    }) : null);
    return { ...entry, moves, maxMoves, zMoves };
  }) || [];
  const forceSwitch = Array.isArray(request.forceSwitch) ? request.forceSwitch :
    request.forceSwitch ? [true] : undefined;
  const sideSize = request.side?.pokemon?.length || previousBattle?.team.length || 1;
  const chosenTeamSize = normalizedType === 'team' ? request.chosenTeamSize || request.maxChosenTeamSize || 1 : request.chosenTeamSize;

  return {
    ...request,
    active,
    forceSwitch,
    requestType: normalizedType,
    chosenTeamSize,
    noCancel: !!request.noCancel || normalizedType === 'wait',
    targetable: request.targetable ?? (active.length > 1 || (sideSize > 1 && active.length > 1)),
  };
}

/**
 * Drops exact HP when a Pokémon turns out to belong to the opponent. Anything
 * recorded while we assumed the wrong side was read as our own, and the exact
 * figures were never ours to know.
 */
const asOpponent = (pokemon: PokemonSet): PokemonSet => ({
  ...pokemon,
  currentHp: undefined,
  maxHp: undefined,
});

export function battleFromRequest(roomId: string, request: BattleRequest, previousBattle: ArenaBattle = emptyBattle): ArenaBattle {
  const normalized = normalizeBattleRequest(request, previousBattle);
  const playerSide = request.side?.id === 'p2' ? 'p2' : request.side?.id === 'p1' ? 'p1' : previousBattle.playerSide;

  // Protocol lines processed before we knew our side were bucketed against a
  // p1 default. If the request contradicts that, the rosters are the wrong way
  // round — swap them rather than leaving the opponent's nameplate showing our
  // own Pokémon.
  const previous = previousBattle.playerSide && playerSide && previousBattle.playerSide !== playerSide ?
    {
      ...previousBattle,
      active: previousBattle.opponentActive,
      opponentActive: asOpponent(previousBattle.active),
      team: previousBattle.opponentTeam,
      opponentTeam: previousBattle.team.map(asOpponent),
    } :
    previousBattle;
  const generation = genFromFormat(previous.format);
  const team = request.side?.pokemon?.map((pokemon, index): PokemonSet => {
    const name = pokemon.ident.split(': ')[1] || speciesFromDetails(pokemon.details);
    const details = parseDetails(pokemon.details, generation);
    const condition = parseCondition(pokemon.condition);
    return {
      slot: index + 1,
      name,
      species: details.species,
      hp: condition.hp,
      currentHp: condition.currentHp,
      maxHp: condition.maxHp,
      status: condition.status,
      fainted: condition.fainted,
      types: details.types,
      level: details.level,
      gender: details.gender,
      shiny: details.shiny,
      active: !!pokemon.active,
    };
  }) || previous.team;

  const active = team.find(pokemon => pokemon.active) || team[0] || previous.active;
  const activeRequest = normalized.active?.[0];
  const requestMoves = activeRequest?.moves || [];
  // The opposing active's typing drives the effectiveness hint on each move.
  const defenderTypes = previous.opponentActive?.terastallized ?
    [previous.opponentActive.terastallized] :
    previous.opponentActive?.types;

  const moves = requestMoves.length ? requestMoves.map((move, index): BattleChoice => {
    const name = move.move || idToName(move.id || `Move ${index + 1}`);
    // The server omits move metadata from |request|; only the dex has it.
    const data = getMove(move.id || name, generation);
    const type = (move.type || data?.type || 'Normal') as TypeName;
    const isStatus = (data?.category || 'Status') === 'Status';
    const multiplier = isStatus || !defenderTypes?.length ?
      null :
      effectiveness(type, defenderTypes, generation);

    return {
      slot: index + 1,
      activeIndex: 0,
      name,
      type,
      pp: `${move.pp ?? data?.pp ?? '-'}/${move.maxpp ?? data?.pp ?? '-'}`,
      ppLeft: move.pp,
      ppMax: move.maxpp ?? data?.pp,
      cmd: `/choose move ${index + 1}${request.rqid ? `|${request.rqid}` : ''}`,
      effectiveness: formatEffectiveness(multiplier) ?? undefined,
      category: data?.category,
      basePower: data?.basePower || undefined,
      accuracy: data?.accuracy,
      description: data?.shortDesc || data?.desc,
      disabled: move.disabled,
      target: move.target || data?.target,
      requiresTarget: normalized.targetable && canChooseTarget(move.target || data?.target),
      targetOptions: normalized.targetable && canChooseTarget(move.target || data?.target) ?
        defaultTargetOptions(move.target || data?.target) : undefined,
      canMegaEvo: !!activeRequest?.canMegaEvo,
      canUltraBurst: !!activeRequest?.canUltraBurst,
      canZMove: Array.isArray(activeRequest?.zMoves) ? !!activeRequest.zMoves[index] : !!activeRequest?.canZMove,
      canDynamax: !!activeRequest?.canDynamax,
      canTerastallize: !!activeRequest?.canTerastallize,
    };
  }) : previous.moves;

  return {
    ...previous,
    id: roomId || previous.id,
    playerSide,
    rqid: request.rqid,
    requestType: normalized.requestType,
    waiting: !!request.wait || normalized.requestType === 'wait',
    p1: playerSide === 'p2' ? previous.p1 : { ...previous.p1, name: request.side?.name || previous.p1.name },
    p2: playerSide === 'p2' ? { ...previous.p2, name: request.side?.name || previous.p2.name } : previous.p2,
    active,
    team,
    moves,
    noCancel: normalized.noCancel,
    trapped: !!activeRequest?.trapped,
    maybeTrapped: !!activeRequest?.maybeTrapped,
    targetable: normalized.targetable,
    teamPreviewSize: normalized.chosenTeamSize,
    mode: normalized.requestType === 'wait' ? 'waiting' : 'player',
    choiceError: undefined,
    choiceDraft: { choices: [] },
  };
}

type BattleProtocolLine = {
  command: string;
  args: string[];
};

const protocolIdent = (ident: string) => {
  const match = ident.match(/^(p[12])([a-z])?:\s*(.+)$/i);
  if (!match) return null;
  return {
    side: match[1].toLowerCase() as 'p1' | 'p2',
    activeIndex: match[2] ? Math.max(0, match[2].toLowerCase().charCodeAt(0) - 97) : 0,
    name: match[3].trim(),
  };
};

const samePokemon = (pokemon: PokemonSet, name: string, species?: string) =>
  speciesId(pokemon.name) === speciesId(name) ||
  (!!species && speciesId(pokemon.species) === speciesId(species));

const updateRosterPokemon = (
  roster: PokemonSet[],
  name: string,
  patch: Partial<PokemonSet>,
  species?: string
) => {
  const index = roster.findIndex(pokemon => samePokemon(pokemon, name, species));
  if (index < 0) {
    return [...roster, {
      slot: roster.length + 1,
      name,
      species: species || speciesId(name),
      hp: 100,
      ...patch,
    }];
  }
  return roster.map((pokemon, pokemonIndex) => pokemonIndex === index ? { ...pokemon, ...patch } : pokemon);
};

/**
 * `knowsExactHp` decides whether exact HP is meaningful. It is true only for
 * your own side in a battle you are playing: the server reports everyone else
 * as a fraction of 100, and a spectator or replay viewer gets percentages for
 * both sides. Carrying those through as currentHp/maxHp renders "100/100",
 * indistinguishable from a real HP total the client cannot know.
 */
const conditionPatch = (condition: string, exactHpKnown: boolean): Partial<PokemonSet> => {
  const parsed = parseCondition(condition);
  return {
    hp: parsed.hp,
    currentHp: exactHpKnown ? parsed.currentHp : undefined,
    maxHp: exactHpKnown ? parsed.maxHp : undefined,
    status: parsed.status,
    fainted: parsed.fainted,
  };
};

/** True only when we are a player in this battle and this is our own side. */
const knowsExactHp = (battle: ArenaBattle, isOwn: boolean) =>
  isOwn && battle.mode !== 'spectator' && battle.mode !== 'ended';

const updatePokemonFromIdent = (
  battle: ArenaBattle,
  identText: string,
  patch: Partial<PokemonSet> | ((context: { exactHpKnown: boolean }) => Partial<PokemonSet>),
  species?: string
): ArenaBattle => {
  const ident = protocolIdent(identText);
  if (!ident) return battle;
  const ownSide = battle.playerSide || 'p1';
  const isOwn = ident.side === ownSide;
  const activeKey = isOwn ? 'active' : 'opponentActive';
  const rosterKey = isOwn ? 'team' : 'opponentTeam';
  const active = battle[activeKey];
  // Some patches depend on which side the ident belongs to, which is only
  // resolved here.
  const resolved = typeof patch === 'function' ? patch({ exactHpKnown: knowsExactHp(battle, isOwn) }) : patch;
  const nextActive = samePokemon(active, ident.name, species) ? { ...active, ...resolved } : active;
  return {
    ...battle,
    [activeKey]: nextActive,
    [rosterKey]: updateRosterPokemon(battle[rosterKey], ident.name, resolved, species),
  };
};

const switchPokemon = (
  battle: ArenaBattle,
  identText: string,
  details: string,
  condition: string
): ArenaBattle => {
  const ident = protocolIdent(identText);
  if (!ident) return battle;
  const ownSide = battle.playerSide || 'p1';
  const isOwn = ident.side === ownSide;
  const activeKey = isOwn ? 'active' : 'opponentActive';
  const rosterKey = isOwn ? 'team' : 'opponentTeam';
  const parsed = parseDetails(details, genFromFormat(battle.format));
  const species = parsed.species;
  const patch: Partial<PokemonSet> = {
    ...conditionPatch(condition, knowsExactHp(battle, isOwn)),
    active: true,
    name: ident.name,
    species,
    types: parsed.types,
    level: parsed.level,
    gender: parsed.gender,
    shiny: parsed.shiny,
    // Stat stages and volatiles do not survive a switch, and the incoming
    // Pokémon carries its own Terastallization state.
    terastallized: undefined,
    boosts: undefined,
    volatiles: undefined,
  };
  const roster = updateRosterPokemon(
    battle[rosterKey].map(pokemon => ({ ...pokemon, active: false })),
    ident.name,
    patch,
    species
  );
  const active = roster.find(pokemon => samePokemon(pokemon, ident.name, species)) || {
    slot: ident.activeIndex + 1,
    name: ident.name,
    species,
    ...conditionPatch(condition, knowsExactHp(battle, isOwn)),
    types: parsed.types,
    level: parsed.level,
    gender: parsed.gender,
    shiny: parsed.shiny,
    active: true,
  };
  return { ...battle, [activeKey]: active, [rosterKey]: roster };
};

const conditionLabel = (raw: string) => raw
  .replace(/^move:\s*/i, '')
  .replace(/^ability:\s*/i, '')
  .replace(/^item:\s*/i, '');


const BOOST_IDS = new Set<string>(['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion']);

const clampStage = (value: number) => Math.max(-6, Math.min(6, value));

/** Applies a stat-stage delta, dropping keys that return to neutral. */
const withBoost = (pokemon: PokemonSet, stat: string, delta: number, absolute = false): PokemonSet => {
  if (!BOOST_IDS.has(stat)) return pokemon;
  const id = stat as BoostId;
  const next = { ...(pokemon.boosts || {}) };
  const value = clampStage(absolute ? delta : (next[id] || 0) + delta);
  if (value === 0) delete next[id];
  else next[id] = value;
  return { ...pokemon, boosts: Object.keys(next).length ? next : undefined };
};

const withVolatile = (pokemon: PokemonSet, name: string, add: boolean): PokemonSet => {
  const label = conditionLabel(name);
  if (!label) return pokemon;
  const current = pokemon.volatiles || [];
  if (add) {
    if (current.includes(label)) return pokemon;
    return { ...pokemon, volatiles: [...current, label] };
  }
  const next = current.filter(entry => entry !== label);
  return { ...pokemon, volatiles: next.length ? next : undefined };
};

/** Side conditions stack (Spikes up to 3, Toxic Spikes up to 2). */
const withSideCondition = (conditions: SideCondition[] | undefined, name: string, add: boolean): SideCondition[] => {
  const label = conditionLabel(name);
  const list = conditions || [];
  if (!label) return list;
  const index = list.findIndex(entry => entry.name === label);
  if (!add) return list.filter(entry => entry.name !== label);
  if (index < 0) return [...list, { name: label, layers: 1 }];
  return list.map((entry, entryIndex) =>
    entryIndex === index ? { ...entry, layers: entry.layers + 1 } : entry);
};

/** Resolves which side of the battle a `p1: Name` / `p1a: Name` ident is on. */
const sideKeys = (battle: ArenaBattle, side: 'p1' | 'p2') => {
  const isOwn = side === (battle.playerSide || 'p1');
  return {
    isOwn,
    conditionsKey: (isOwn ? 'sideConditions' : 'opponentSideConditions') as
      'sideConditions' | 'opponentSideConditions',
  };
};

/** Applies a transform to whichever active Pokémon an ident refers to. */
const updateActiveFromIdent = (
  battle: ArenaBattle,
  identText: string,
  transform: (pokemon: PokemonSet) => PokemonSet
): ArenaBattle => {
  const ident = protocolIdent(identText);
  if (!ident) return battle;
  const isOwn = ident.side === (battle.playerSide || 'p1');
  const activeKey = isOwn ? 'active' : 'opponentActive';
  const rosterKey = isOwn ? 'team' : 'opponentTeam';
  const updated = transform(battle[activeKey]);
  return {
    ...battle,
    [activeKey]: updated,
    [rosterKey]: battle[rosterKey].map(pokemon =>
      samePokemon(pokemon, ident.name) ? transform(pokemon) : pokemon),
  };
};

const identSide = (raw: string): 'p1' | 'p2' | null => {
  const match = /^(p[12])/.exec(raw.trim());
  return match ? (match[1] as 'p1' | 'p2') : null;
};

/**
 * Projects the subset of PS battle protocol needed by the React battle scene.
 * The legacy simulator remains authoritative; this adapter keeps the modern HUD
 * in sync without coupling components to raw protocol strings.
 */
export function applyBattleProtocolLine(battle: ArenaBattle, line: BattleProtocolLine): ArenaBattle {
  const { command, args } = line;
  switch (command) {
  case 'switch':
  case 'drag':
  case 'replace':
    return switchPokemon(battle, args[0] || '', args[1] || '', args[2] || '');
  case '-damage':
  case '-heal':
    return updatePokemonFromIdent(battle, args[0] || '', ctx => conditionPatch(args[1] || '', ctx.exactHpKnown));
  case '-status':
    return updatePokemonFromIdent(battle, args[0] || '', { status: statusFromCondition(` ${args[1] || ''}`) });
  case '-curestatus':
    return updatePokemonFromIdent(battle, args[0] || '', { status: undefined });
  case 'faint':
    return updatePokemonFromIdent(battle, args[0] || '', { hp: 0, fainted: true, active: true });
  case 'poke': {
    const side = args[0] === 'p2' ? 'p2' : 'p1';
    const ownSide = battle.playerSide || 'p1';
    const rosterKey = side === ownSide ? 'team' : 'opponentTeam';
    const parsed = parseDetails(args[1] || 'Pokemon', genFromFormat(battle.format));
    if (battle[rosterKey].some(pokemon => speciesId(pokemon.species) === speciesId(parsed.species))) return battle;
    return {
      ...battle,
      [rosterKey]: [...battle[rosterKey], {
        slot: battle[rosterKey].length + 1,
        name: parsed.species,
        species: parsed.species,
        hp: 100,
        types: parsed.types,
        level: parsed.level,
        gender: parsed.gender,
        shiny: parsed.shiny,
      }],
    };
  }
  case '-terastallize':
    return updatePokemonFromIdent(battle, args[0] || '', { terastallized: args[1] as TypeName });

  // ── Stat stages ──────────────────────────────────────────────────────────
  case '-boost':
  case '-unboost': {
    const delta = (Number(args[2]) || 0) * (command === '-unboost' ? -1 : 1);
    return updateActiveFromIdent(battle, args[0] || '', pokemon => withBoost(pokemon, args[1] || '', delta));
  }
  case '-setboost':
    return updateActiveFromIdent(battle, args[0] || '', pokemon =>
      withBoost(pokemon, args[1] || '', Number(args[2]) || 0, true));
  case '-clearboost':
  case '-clearnegativeboost':
    return updateActiveFromIdent(battle, args[0] || '', pokemon => ({ ...pokemon, boosts: undefined }));
  case '-clearallboost':
    return {
      ...battle,
      active: { ...battle.active, boosts: undefined },
      opponentActive: { ...battle.opponentActive, boosts: undefined },
    };
  case '-copyboost':
  case '-swapboost':
    // Rare enough that mirroring the source is better than showing nothing.
    return battle;

  // ── Volatiles ────────────────────────────────────────────────────────────
  case '-start':
    return updateActiveFromIdent(battle, args[0] || '', pokemon => withVolatile(pokemon, args[1] || '', true));
  case '-end':
    return updateActiveFromIdent(battle, args[0] || '', pokemon => withVolatile(pokemon, args[1] || '', false));

  // ── Reveals ──────────────────────────────────────────────────────────────
  case '-item':
    return updateActiveFromIdent(battle, args[0] || '', pokemon => ({ ...pokemon, item: args[1] }));
  case '-enditem':
    return updateActiveFromIdent(battle, args[0] || '', pokemon => ({ ...pokemon, item: undefined }));
  case '-ability':
    return updateActiveFromIdent(battle, args[0] || '', pokemon => ({ ...pokemon, ability: args[1] }));

  // ── Hazards and screens ──────────────────────────────────────────────────
  case '-sidestart':
  case '-sideend': {
    const side = identSide(args[0] || '');
    if (!side) return battle;
    const { conditionsKey } = sideKeys(battle, side);
    return {
      ...battle,
      [conditionsKey]: withSideCondition(battle[conditionsKey], args[1] || '', command === '-sidestart'),
    };
  }
  case 'detailschange':
  case '-formechange': {
    const parsed = parseDetails(args[1] || '', genFromFormat(battle.format));
    return updatePokemonFromIdent(
      battle,
      args[0] || '',
      { species: parsed.species, types: parsed.types },
      parsed.species
    );
  }
  case 'clearpoke':
    return { ...battle, team: [], opponentTeam: [] };
  case '-weather':
    return { ...battle, weather: !args[0] || args[0] === 'none' ? undefined : conditionLabel(args[0]) };
  case '-fieldstart': {
    const condition = conditionLabel(args[0] || '');
    const fieldConditions = [...new Set([...(battle.fieldConditions || []), condition])].filter(Boolean);
    return { ...battle, fieldConditions };
  }
  case '-fieldend': {
    const condition = conditionLabel(args[0] || '');
    return { ...battle, fieldConditions: (battle.fieldConditions || []).filter(entry => entry !== condition) };
  }
  case 'start':
    return { ...battle, waiting: false, ended: false, mode: battle.mode === 'spectator' ? 'spectator' : battle.mode };
  case 'win':
    return { ...battle, winner: args[0], ended: true, waiting: true, mode: 'ended' };
  case 'turn':
    return { ...battle, turn: Number(args[0]) || battle.turn, waiting: false };
  case 'tie':
    return { ...battle, winner: undefined, ended: true, waiting: true, mode: 'ended' };
  default:
    return battle;
  }
}

export function buildBattleCommand(choice: BattleChoice | PokemonSet, rqid?: number) {
  if ('cmd' in choice) return `Queued ${choice.name}.`;
  return choice.fainted ? `${choice.name} cannot switch in.` : `Queued switch to ${choice.name}${rqid ? ` for request ${rqid}` : ''}.`;
}

export function commandForChoice(choice: BattleChoice | PokemonSet, rqid?: number) {
  if ('cmd' in choice) {
    if (choice.cmd.startsWith('/choose')) return choice.cmd;
    return rqid ? `/choose ${choice.cmd.replace(/^\//, '')}|${rqid}` : choice.cmd;
  }
  return rqid ? `/choose switch ${choice.slot}|${rqid}` : `/choose switch ${choice.slot}`;
}

export function buildChooseCommand(choice: BattleChoiceState, rqid?: number) {
  const suffix = rqid ? `|${rqid}` : '';
  if (choice.kind === 'pass') return `/choose pass${suffix}`;
  if (choice.kind === 'shift') return `/choose shift${suffix}`;
  if (choice.kind === 'switch') return `/choose switch ${choice.slot}${suffix}`;
  if (choice.kind === 'team') return `/choose team ${choice.order.join(',')}${suffix}`;

  const flags = [
    choice.mega ? 'mega' : '',
    choice.ultra ? 'ultra' : '',
    choice.z ? 'zmove' : '',
    choice.max ? 'dynamax' : '',
    choice.tera ? 'terastallize' : '',
    choice.target ? String(choice.target) : '',
  ].filter(Boolean);
  return `/choose move ${choice.slot}${flags.length ? ` ${flags.join(' ')}` : ''}${suffix}`;
}

const requestLength = (request: BattleRequestNormalized) => {
  switch (request.requestType) {
  case 'move':
    return request.active?.length || 1;
  case 'switch':
    return request.forceSwitch?.length || 1;
  case 'team':
    return request.chosenTeamSize || 1;
  case 'wait':
    return 0;
  }
};

const stringChoice = (choice: BattleChoiceState) => {
  if (choice.kind === 'pass') return 'pass';
  if (choice.kind === 'shift') return 'shift';
  if (choice.kind === 'switch') return `switch ${choice.slot}`;
  if (choice.kind === 'team') return choice.order.map(slot => `team ${slot}`);
  const flags = [
    choice.max ? 'max' : '',
    choice.mega ? 'mega' : '',
    choice.ultra ? 'ultra' : '',
    choice.z ? 'zmove' : '',
    choice.tera ? 'terastallize' : '',
    choice.target ? `${choice.target > 0 ? '+' : ''}${choice.target}` : '',
  ].filter(Boolean);
  return `move ${choice.slot}${flags.length ? ` ${flags.join(' ')}` : ''}`;
};

const choiceIndex = (session: BattleChoiceSession) => session.draft.choices.length;

const currentMoveRequest = (session: BattleChoiceSession, index = choiceIndex(session)) => {
  if (session.request.requestType !== 'move') return null;
  return session.request.active?.[index] || null;
};

const currentMove = (session: BattleChoiceSession, choice: BattleChoiceState & { kind: 'move' }) => {
  const active = currentMoveRequest(session, choice.activeIndex ?? choiceIndex(session));
  if (!active) return null;
  if (choice.max && active.maxMoves?.length) return active.maxMoves[choice.slot - 1] || null;
  if (choice.z && active.zMoves?.length) return active.zMoves[choice.slot - 1] || null;
  return active.moves?.[choice.slot - 1] || null;
};

const fillPasses = (session: BattleChoiceSession) => {
  if (session.request.requestType === 'move') {
    while (session.draft.choices.length < (session.request.active?.length || 0) && !session.request.active?.[session.draft.choices.length]) {
      session.draft.choices.push('pass');
    }
  }
  if (session.request.requestType === 'switch') {
    while (session.draft.choices.length < (session.request.forceSwitch?.length || 0) && !session.request.forceSwitch?.[session.draft.choices.length]) {
      session.draft.choices.push('pass');
    }
  }
};

const cloneSession = (session: BattleChoiceSession): BattleChoiceSession => ({
  ...session,
  draft: {
    choices: [...session.draft.choices],
    pendingMove: session.draft.pendingMove ? { ...session.draft.pendingMove } : undefined,
  },
  alreadySwitchingIn: [...session.alreadySwitchingIn],
});

export function createBattleChoiceSession(request: BattleRequest): BattleChoiceSession {
  const session: BattleChoiceSession = {
    request: normalizeBattleRequest(request),
    draft: { choices: [] },
    noCancel: !!request.noCancel || requestType(request) === 'wait',
    alreadySwitchingIn: [],
    alreadyMega: false,
    alreadyMax: false,
    alreadyZ: false,
    alreadyTera: false,
  };
  fillPasses(session);
  return session;
}

export function isBattleChoiceComplete(session: BattleChoiceSession) {
  return !session.draft.pendingMove && session.draft.choices.length >= requestLength(session.request);
}

export function addBattleChoice(session: BattleChoiceSession, choice: BattleChoiceState): BattleCommandResult {
  const next = cloneSession(session);

  if (next.request.requestType === 'wait') {
    return { ok: false, complete: false, error: "It's not your turn to choose.", draft: next.draft, session: next };
  }

  if (choice.kind === 'pass') {
    next.draft.choices.push('pass');
  } else if (choice.kind === 'shift') {
    if (next.request.requestType !== 'move') {
      return { ok: false, complete: false, error: 'Shift is only available during move requests.', draft: next.draft, session: next };
    }
    next.draft.choices.push('shift');
  } else if (choice.kind === 'team') {
    if (next.request.requestType !== 'team') {
      return { ok: false, complete: false, error: 'Team preview is not active.', draft: next.draft, session: next };
    }
    const targetSlots = choice.order.length ? choice.order : [];
    for (const slot of targetSlots) {
      const pokemon = next.request.side?.pokemon?.[slot - 1];
      if (!pokemon) return { ok: false, complete: false, error: `Team slot ${slot} is unavailable.`, draft: next.draft, session: next };
      if (pokemon.condition.includes('fnt')) return { ok: false, complete: false, error: `${pokemon.ident} has fainted.`, draft: next.draft, session: next };
      if (next.alreadySwitchingIn.includes(slot)) {
        return { ok: false, complete: false, error: `${pokemon.ident} is already selected.`, draft: next.draft, session: next };
      }
      next.alreadySwitchingIn.push(slot);
      next.draft.choices.push(`team ${slot}`);
      if (isBattleChoiceComplete(next)) break;
    }
  } else if (choice.kind === 'switch') {
    if (next.request.requestType !== 'switch' && next.request.requestType !== 'move') {
      return { ok: false, complete: false, error: 'Switching is not available for this request.', draft: next.draft, session: next };
    }
    if (currentMoveRequest(next)?.trapped) {
      return { ok: false, complete: false, error: 'You are trapped and cannot switch out.', draft: next.draft, session: next };
    }
    const pokemon = next.request.side?.pokemon?.[choice.slot - 1];
    if (!pokemon) return { ok: false, complete: false, error: `Switch slot ${choice.slot} is unavailable.`, draft: next.draft, session: next };
    if (choice.slot - 1 < requestLength(next.request)) {
      return { ok: false, complete: false, error: 'That Pokemon is already active.', draft: next.draft, session: next };
    }
    if (pokemon.condition.includes('fnt')) {
      return { ok: false, complete: false, error: `${pokemon.ident} has fainted.`, draft: next.draft, session: next };
    }
    if (next.alreadySwitchingIn.includes(choice.slot)) {
      return { ok: false, complete: false, error: 'That Pokemon is already selected.', draft: next.draft, session: next };
    }
    next.alreadySwitchingIn.push(choice.slot);
    next.draft.choices.push(`switch ${choice.slot}`);
  } else if (choice.kind === 'move') {
    if (next.request.requestType !== 'move') {
      return { ok: false, complete: false, error: 'You must switch, not move.', draft: next.draft, session: next };
    }
    const active = currentMoveRequest(next, choice.activeIndex ?? choiceIndex(next));
    const move = currentMove(next, choice);
    if (!active || !move || move.disabled) {
      return { ok: false, complete: false, error: `Move ${move?.move || choice.slot} is disabled.`, draft: next.draft, session: next };
    }
    if (choice.max && !active.canDynamax) choice = { ...choice, max: false };
    if (choice.mega && next.alreadyMega) return { ok: false, complete: false, error: 'Mega Evolution is already selected.', draft: next.draft, session: next };
    if (choice.z && next.alreadyZ) return { ok: false, complete: false, error: 'A Z-Move is already selected.', draft: next.draft, session: next };
    if (choice.max && next.alreadyMax) return { ok: false, complete: false, error: 'Dynamax is already selected.', draft: next.draft, session: next };
    if (choice.tera && next.alreadyTera) return { ok: false, complete: false, error: 'Terastallization is already selected.', draft: next.draft, session: next };
    if (next.request.targetable && canChooseTarget(move.target) && !choice.target) {
      next.draft.pendingMove = choice;
      return { ok: true, complete: false, draft: next.draft, session: next, message: 'Choose a target.' };
    }
    if (choice.mega) next.alreadyMega = true;
    if (choice.z) next.alreadyZ = true;
    if (choice.max) next.alreadyMax = true;
    if (choice.tera) next.alreadyTera = true;
    next.draft.pendingMove = undefined;
    next.draft.choices.push(stringChoice(choice) as string);
  }

  fillPasses(next);
  const complete = isBattleChoiceComplete(next);
  const choiceString = next.draft.choices.join(', ').replace(/, team /g, ', ');
  const command = complete ? `/choose ${choiceString}${next.request.rqid ? `|${next.request.rqid}` : ''}` : undefined;
  return { ok: true, complete, command, draft: next.draft, session: next };
}

export function battleDecisionState(roomId: string, battle: ArenaBattle, session?: BattleChoiceSession, error?: string): BattleDecisionState {
  return {
    roomId,
    mode: battle.mode || (battle.requestType === 'wait' ? 'waiting' : 'player'),
    requestType: battle.requestType,
    requestLength: session ? requestLength(session.request) : battle.requestType === 'team' ? battle.teamPreviewSize || 1 : 0,
    noCancel: battle.noCancel || !!session?.noCancel,
    waiting: !!battle.waiting,
    targetable: !!battle.targetable,
    draft: session?.draft || battle.choiceDraft || { choices: [] },
    error: error || battle.choiceError,
  };
}

export function createChoiceBuilder(request: BattleRequest): ChoiceBuilderAdapter {
  const normalized = normalizeBattleRequest(request);
  const type = normalized.requestType;

  return {
    request: normalized,
    requestType: type,
    requestLength: requestLength(normalized),
    noCancel: normalized.noCancel,
    build: choice => buildChooseCommand(choice, normalized.rqid),
  };
}
