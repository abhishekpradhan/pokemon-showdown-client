import { effectiveness, formatEffectiveness, genFromFormat, getMove, type TypeName } from '../data/dex';

export type BattleSideID = 'p1' | 'p2' | 'p3' | 'p4';
export const isBattleSideID = (value: unknown): value is BattleSideID =>
  typeof value === 'string' && /^p[1-4]$/.test(value);
export const battleSideIndex = (side: BattleSideID) => Number(side[1]) - 1;
export const isFourPlayerBattle = (gameType?: string) => gameType === 'multi' || gameType === 'freeforall';

export type PokemonSet = {
  slot: number;
  sideId?: BattleSideID;
  name: string;
  /** Display species, e.g. `Pikachu-Original`. Sprite lookup uses this. */
  species: string;
  /** Percentage, always known. The opponent's exact HP never is. */
  hp: number;
  hpKnown?: boolean;
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
  effectiveAbility?: string;
  grounded?: boolean;
  itemSuppressed?: boolean;
  lastItem?: string;
  stats?: Record<string, number>;
  knownMoves?: { name: string; pp?: number; maxpp?: number; used?: number | [number, number] }[];
  speedRange?: [number, number];
  counters?: string[];
  active?: boolean;
  fainted?: boolean;
};

export type BoostId = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion';

export const BOOST_LABELS: Record<BoostId, string> = {
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
  accuracy: 'Acc',
  evasion: 'Eva',
};

/** Entry hazards and screens, tracked per side with their layer count. */
export type SideCondition = { name: string; layers: number; duration?: [number, number] };

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
  zMove?: BattleChoice;
  maxMove?: BattleChoice;
  modifier?: 'zmove' | 'dynamax';
  notes?: string[];
};

export type ArenaBattleSide = {
  id: BattleSideID;
  name: string;
  rating: number;
  team: PokemonSet[];
  teamSize: number;
  actives: PokemonSet[];
  conditions: SideCondition[];
};

export type BattleFieldPosition = {
  sideId: BattleSideID;
  owner: string;
  half: 'near' | 'far';
  /** One-based location within a field half; independent of the owner's roster. */
  slot: number;
  pokemon?: PokemonSet;
  relation: 'you' | 'ally' | 'opponent';
};

export type ArenaBattle = {
  id: string;
  format: string;
  gameType?: string;
  generation?: number;
  teamPreviewCount?: number;
  teamSize?: number;
  opponentTeamSize?: number;
  supportReason?: string;
  engineWarning?: string;
  logTruncated?: boolean;
  turn: number;
  playerSide?: BattleSideID;
  p1: { name: string; rating: number };
  p2: { name: string; rating: number };
  p3?: { name: string; rating: number };
  p4?: { name: string; rating: number };
  sides?: ArenaBattleSide[];
  active: PokemonSet;
  opponentActive: PokemonSet;
  /** All active slots per side, in position order — doubles renders these. */
  actives?: PokemonSet[];
  opponentActives?: PokemonSet[];
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
  reviving?: boolean;
  commanding?: boolean;
};

export type BattleRequest = {
  gameType?: string;
  teamPreviewCount?: number;
  rqid?: number;
  wait?: boolean;
  forceSwitch?: boolean | boolean[];
  teamPreview?: boolean;
  side?: {
    id?: string;
    name?: string;
    pokemon?: BattleRequestPokemon[];
  };
  /** Explicit server-disclosed partner data in multi battles; never present in FFA. */
  ally?: {
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
  | {
      kind: 'move';
      slot: number;
      activeIndex?: number;
      target?: number;
      mega?: boolean;
      ultra?: boolean;
      z?: boolean;
      max?: boolean;
      tera?: boolean;
    }
  | { kind: 'switch'; slot: number }
  | { kind: 'team'; order: number[] }
  | { kind: 'confirm' }
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

export type BattleRequestNormalized = Omit<
  BattleRequest,
  'active' | 'forceSwitch' | 'requestType' | 'noCancel' | 'targetable'
> & {
  requestType: 'move' | 'switch' | 'team' | 'wait';
  forceSwitch?: boolean[];
  active?: Array<{
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
  } | null>;
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
  status?: 'drafting' | 'submitted' | 'cancelling';
};

/** Only advertise game types whose complete choice/field model is implemented. */
export function battleSupport(formatId = '', gameType?: string): { supported: boolean; reason?: string } {
  const rotation = gameType === 'rotation' || /rotation/i.test(formatId);
  const unsupported =
    gameType && !['singles', 'doubles', 'triples', 'multi', 'freeforall'].includes(gameType);
  return rotation || unsupported
    ? {
        supported: false,
        reason: rotation
          ? 'Rotation battles have no playable rotation rules or choice command in the supported Pokémon Showdown server.'
          : 'This server game type is not recognized by this client.',
      }
    : { supported: true };
}

export function battleFieldPositions(battle: ArenaBattle): BattleFieldPosition[] {
  const viewpoint = battle.playerSide || 'p1';
  const nearParity = battleSideIndex(viewpoint) % 2;
  const four = isFourPlayerBattle(battle.gameType);
  const sides = battle.sides || [
    {
      id: viewpoint,
      name: battle[viewpoint]?.name || battle.p1.name,
      actives: battle.actives || [battle.active],
    },
    {
      id: (nearParity ? 'p1' : 'p2') as BattleSideID,
      name: (nearParity ? battle.p1 : battle.p2).name,
      actives: battle.opponentActives || [battle.opponentActive],
    },
  ];
  const count = four ? 1 : battle.gameType === 'triples' ? 3 : battle.gameType === 'doubles' ? 2 : 1;
  return sides.flatMap(side =>
    Array.from({ length: count }, (_, index) => {
      const near = battleSideIndex(side.id) % 2 === nearParity;
      return {
        sideId: side.id,
        owner: side.name,
        half: near ? ('near' as const) : ('far' as const),
        slot: four ? Math.floor(battleSideIndex(side.id) / 2) + 1 : index + 1,
        pokemon: side.actives.find(pokemon => pokemon.slot === index + 1),
        relation:
          side.id === viewpoint
            ? ('you' as const)
            : near && battle.gameType !== 'freeforall'
              ? ('ally' as const)
              : ('opponent' as const),
      };
    }),
  );
}

export function battleTargetAt(battle: ArenaBattle, target: number): BattleFieldPosition | undefined {
  return battleFieldPositions(battle).find(
    position => position.half === (target > 0 ? 'far' : 'near') && position.slot === Math.abs(target),
  );
}

/** Stellar preserves the Pokémon's original defensive typing. */
export function defensiveTypes(pokemon: Pick<PokemonSet, 'types' | 'terastallized'>): TypeName[] | undefined {
  return pokemon.terastallized && pokemon.terastallized !== 'Stellar'
    ? [pokemon.terastallized]
    : pokemon.types;
}

/** Runtime validation protects the decision boundary; TS types do not validate server JSON. */
export function isBattleRequest(value: unknown): value is BattleRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const request = value as BattleRequest;
  if (request.rqid !== undefined && (!Number.isSafeInteger(request.rqid) || request.rqid < 0)) return false;
  if (
    request.forceSwitch !== undefined &&
    typeof request.forceSwitch !== 'boolean' &&
    (!Array.isArray(request.forceSwitch) || request.forceSwitch.some(flag => typeof flag !== 'boolean'))
  )
    return false;
  for (const side of [request.side, request.ally]) {
    if (
      side !== undefined &&
      (!side ||
        typeof side !== 'object' ||
        (side.id !== undefined && !isBattleSideID(side.id)) ||
        !Array.isArray(side.pokemon) ||
        side.pokemon.some(
          pokemon =>
            !pokemon ||
            typeof pokemon.ident !== 'string' ||
            typeof pokemon.details !== 'string' ||
            typeof pokemon.condition !== 'string',
        ))
    )
      return false;
  }
  if (
    request.active !== undefined &&
    (!Array.isArray(request.active) ||
      request.active.some(
        active =>
          active !== null &&
          (!active ||
            typeof active !== 'object' ||
            !Array.isArray(active.moves) ||
            active.moves.some(
              move =>
                !move ||
                typeof move !== 'object' ||
                typeof move.move !== 'string' ||
                (move.target !== undefined && typeof move.target !== 'string'),
            )),
      ))
  )
    return false;
  const specialMovesValid = (moves: unknown, nullable: boolean): boolean =>
    Array.isArray(moves) &&
    moves.every(
      move =>
        (nullable && move === null) ||
        (!!move &&
          typeof move === 'object' &&
          (typeof move.move === 'string' || typeof move.name === 'string') &&
          (move.target === undefined || typeof move.target === 'string')),
    );
  for (const active of request.active || []) {
    if (!active) continue;
    if (active.zMoves !== undefined && !specialMovesValid(active.zMoves, true)) return false;
    if (
      active.canZMove !== undefined &&
      typeof active.canZMove !== 'boolean' &&
      !specialMovesValid(active.canZMove, true)
    )
      return false;
    if (
      active.maxMoves !== undefined &&
      (!active.maxMoves ||
        !specialMovesValid(
          Array.isArray(active.maxMoves) ? active.maxMoves : active.maxMoves.maxMoves,
          false,
        ))
    )
      return false;
  }
  return true;
}

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
    slot: 1,
    name: 'Iron Valiant',
    species: 'Iron Valiant',
    hp: 72,
    currentHp: 227,
    maxHp: 315,
    types: ['Fairy', 'Fighting'],
    level: 100,
    active: true,
  },
  opponentActive: {
    slot: 1,
    name: 'Great Tusk',
    species: 'Great Tusk',
    hp: 44,
    types: ['Ground', 'Fighting'],
    level: 100,
    active: true,
  },
  team: [
    {
      slot: 1,
      name: 'Iron Valiant',
      species: 'Iron Valiant',
      hp: 72,
      currentHp: 227,
      maxHp: 315,
      types: ['Fairy', 'Fighting'],
      active: true,
    },
    {
      slot: 2,
      name: 'Dragapult',
      species: 'Dragapult',
      hp: 100,
      currentHp: 301,
      maxHp: 301,
      types: ['Dragon', 'Ghost'],
    },
    {
      slot: 3,
      name: 'Kingambit',
      species: 'Kingambit',
      hp: 64,
      currentHp: 214,
      maxHp: 334,
      types: ['Dark', 'Steel'],
      status: 'BRN',
    },
    {
      slot: 4,
      name: 'Rotom-Wash',
      species: 'Rotom-Wash',
      hp: 38,
      currentHp: 107,
      maxHp: 281,
      types: ['Electric', 'Water'],
    },
    {
      slot: 5,
      name: 'Amoonguss',
      species: 'Amoonguss',
      hp: 0,
      currentHp: 0,
      maxHp: 404,
      types: ['Grass', 'Poison'],
      fainted: true,
    },
    {
      slot: 6,
      name: 'Heatran',
      species: 'Heatran',
      hp: 88,
      currentHp: 316,
      maxHp: 359,
      types: ['Fire', 'Steel'],
    },
  ],
  opponentTeam: [
    {
      slot: 1,
      name: 'Great Tusk',
      species: 'Great Tusk',
      hp: 44,
      types: ['Ground', 'Fighting'],
      active: true,
    },
    { slot: 2, name: 'Gholdengo', species: 'Gholdengo', hp: 91, types: ['Steel', 'Ghost'] },
    {
      slot: 3,
      name: 'Samurott-Hisui',
      species: 'Samurott-Hisui',
      hp: 0,
      types: ['Water', 'Dark'],
      fainted: true,
    },
    { slot: 4, name: 'Dragonite', species: 'Dragonite', hp: 100, types: ['Dragon', 'Flying'] },
    {
      slot: 5,
      name: 'Slowking-Galar',
      species: 'Slowking-Galar',
      hp: 57,
      types: ['Poison', 'Psychic'],
      status: 'PAR',
    },
    { slot: 6, name: 'Enamorus', species: 'Enamorus', hp: 84, types: ['Fairy', 'Flying'] },
  ],
  weather: 'Sandstorm',
  moves: [
    {
      slot: 1,
      name: 'Moonblast',
      type: 'Fairy',
      pp: '11/16',
      ppLeft: 11,
      ppMax: 16,
      cmd: '/choose move 1',
      effectiveness: '2x',
      category: 'Special',
      basePower: 95,
      accuracy: 100,
    },
    {
      slot: 2,
      name: 'Close Combat',
      type: 'Fighting',
      pp: '7/8',
      ppLeft: 7,
      ppMax: 8,
      cmd: '/choose move 2',
      effectiveness: '1x',
      category: 'Physical',
      basePower: 120,
      accuracy: 100,
    },
    {
      slot: 3,
      name: 'Knock Off',
      type: 'Dark',
      pp: '15/24',
      ppLeft: 15,
      ppMax: 24,
      cmd: '/choose move 3',
      effectiveness: '½x',
      category: 'Physical',
      basePower: 65,
      accuracy: 100,
    },
    {
      slot: 4,
      name: 'Encore',
      type: 'Normal',
      pp: '2/8',
      ppLeft: 2,
      ppMax: 8,
      cmd: '/choose move 4',
      category: 'Status',
      accuracy: 100,
    },
  ],
  requestType: 'move',
  mode: 'player',
  log: ['Turn 12 started.', 'Pointed stones dug into Great Tusk.', 'Iron Valiant awaits your command.'],
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

const idToName = (id: string) =>
  id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());

const speciesId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

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

const canChooseTarget = (target?: string) =>
  ['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe'].includes(target || '');

/**
 * Slots a chosen-target move may point at, in PS protocol convention:
 * Positive numbers identify the opposite half; negative numbers identify
 * the viewer's half. FFA opponents also occupy that negative half. The
 * mirrored adjacency rule matches sim/battle.ts validTargetLoc.
 */
export const moveTargetOptions = (
  target: string | undefined,
  slots = 2,
  activeIndex = 0,
  gameType?: string,
  side: BattleSideID = 'p1',
): number[] => {
  const source = -(
    activeIndex +
    1 +
    (isFourPlayerBattle(gameType) ? Math.floor(battleSideIndex(side) / 2) : 0)
  );
  const count = isFourPlayerBattle(gameType) ? 2 : slots;
  const positive = Array.from({ length: count }, (_, index) => index + 1);
  return [...positive, ...positive.map(slot => -slot)].filter(location => {
    const self = location === source;
    const foe = gameType === 'freeforall' ? !self : location > 0;
    const adjacent =
      location > 0 ? Math.abs(-(count + 1 - location) - source) <= 1 : Math.abs(location - source) === 1;
    if (target === 'adjacentAlly' && gameType === 'freeforall') return adjacent;
    if (target === 'normal') return adjacent;
    if (target === 'any') return !self;
    if (target === 'adjacentAlly') return adjacent && !foe;
    if (target === 'adjacentAllyOrSelf') return (adjacent && !foe) || self;
    if (target === 'adjacentFoe') return adjacent && foe;
    return false;
  });
};

export const requestTargetOptions = (request: BattleRequest, target: string | undefined, activeIndex = 0) =>
  moveTargetOptions(
    target,
    request.active?.length || (request.gameType === 'triples' ? 3 : 2),
    activeIndex,
    request.gameType,
    isBattleSideID(request.side?.id) ? request.side.id : 'p1',
  );

const normalizeSpecialMoves = (active: NonNullable<BattleRequest['active']>[number]) => {
  if (!active || !active.maxMoves) return [];
  if (Array.isArray(active.maxMoves)) return active.maxMoves;
  return active.maxMoves.maxMoves || [];
};

export function normalizeBattleRequest(
  request: BattleRequest,
  previousBattle?: ArenaBattle,
): BattleRequestNormalized {
  const normalizedType = requestType(request) || 'wait';
  const active =
    request.active?.map((entry, index) => {
      if (
        !entry ||
        request.side?.pokemon?.[index]?.condition.includes('fnt') ||
        request.side?.pokemon?.[index]?.commanding
      )
        return null;
      const moves = (entry.moves || []).map(move => ({
        ...move,
        id: move.id || speciesId(move.move || ''),
      }));
      const maxMoves: BattleRequestSpecialMove[] = normalizeSpecialMoves(entry).map(move => ({
        ...move,
        move: move.move || move.name || 'Move',
        id: move.id || speciesId(move.move || move.name || ''),
      }));
      const zMoves: Array<BattleRequestSpecialMove | null> | undefined = (
        Array.isArray(entry.canZMove) ? entry.canZMove : entry.zMoves
      )?.map(move =>
        move
          ? {
              ...move,
              move: move.move || move.name || 'Move',
              id: move.id || speciesId(move.move || move.name || ''),
            }
          : null,
      );
      return { ...entry, moves, maxMoves, zMoves };
    }) || [];
  const forceSwitch = Array.isArray(request.forceSwitch)
    ? request.forceSwitch
    : request.forceSwitch
      ? [true]
      : undefined;
  const knownSideSize = request.side?.pokemon?.length || previousBattle?.team.length;
  const sideSize = knownSideSize || 1;
  const gameType = request.gameType || previousBattle?.gameType;
  const previewCount = request.teamPreviewCount || previousBattle?.teamPreviewCount;
  const illusion = request.side?.pokemon?.some(
    pokemon => speciesId(pokemon.baseAbility || pokemon.ability || '') === 'illusion',
  );
  const chosenTeamSize =
    normalizedType === 'team'
      ? Math.min(
          knownSideSize || Infinity,
          request.chosenTeamSize ||
            request.maxChosenTeamSize ||
            previewCount ||
            (illusion ? sideSize : gameType === 'doubles' ? 2 : gameType === 'triples' ? 3 : 1),
        )
      : request.chosenTeamSize;

  return {
    ...request,
    gameType,
    teamPreviewCount: previewCount,
    active,
    forceSwitch,
    requestType: normalizedType,
    chosenTeamSize,
    noCancel: !!request.noCancel || normalizedType === 'wait',
    targetable:
      request.targetable ??
      (active.length > 1 || ['doubles', 'triples', 'multi', 'freeforall'].includes(gameType || '')),
  };
}

/**
 * Builds the move deck the action panel renders, from a raw |request|.
 * Defender types (the opposing active, tera-aware) drive the effectiveness
 * hint on each card.
 */
export function buildMoveDeck(
  request: BattleRequest,
  defenderTypes: TypeName[] | undefined,
  formatId?: string,
  activeIndex = 0,
  defender?: PokemonSet,
  attacker?: PokemonSet,
  weather?: string,
): BattleChoice[] {
  const generation = genFromFormat(formatId);
  const normalized = normalizeBattleRequest(request);
  const activeRequest = normalized.active?.[activeIndex];
  const requestMoves = activeRequest?.moves || [];

  const hintFor = (
    type: TypeName,
    category: BattleChoice['category'],
    id: string,
  ): { effectiveness?: string; notes: string[] } => {
    if (category === 'Status' || !defenderTypes?.length) return { notes: [] };
    const groundHitsAir = type === 'Ground' && (defender?.grounded || id === 'thousandarrows');
    const types = groundHitsAir ? defenderTypes.filter(entry => entry !== 'Flying') : defenderTypes;
    let multiplier = types.length ? effectiveness(type, types, generation) : 1;
    const notes: string[] = [];
    const attackAbility = attacker?.effectiveAbility ?? attacker?.ability ?? '';
    const defendAbility = defender?.effectiveAbility ?? defender?.ability ?? '';
    const ignoresAbility =
      ['moldbreaker', 'teravolt', 'turboblaze'].includes(speciesId(attackAbility)) ||
      [
        'sunsteelstrike',
        'moongeistbeam',
        'photongeyser',
        'searingsunrazesmash',
        'menacingmoonrazemaelstrom',
        'lightthatburnsthesky',
      ].includes(id);
    const immunityAbilities: Partial<Record<TypeName, string[]>> = {
      Ground: ['levitate'],
      Water: ['waterabsorb', 'stormdrain', 'dryskin'],
      Electric: ['voltabsorb', 'lightningrod', 'motordrive'],
      Fire: ['flashfire', 'wellbakedbody'],
      Grass: ['sapsipper'],
    };
    const balloon =
      type === 'Ground' && !defender?.itemSuppressed && speciesId(defender?.item || '') === 'airballoon';
    const abilityImmune = !ignoresAbility && immunityAbilities[type]?.includes(speciesId(defendAbility));
    if (!(type === 'Ground' && groundHitsAir) && (balloon || abilityImmune)) {
      multiplier = 0;
      notes.push(`Immune through known ${balloon ? 'Air Balloon' : defender?.ability}.`);
    }
    if (type === 'Stellar' && defender) multiplier = defender.terastallized ? 2 : 1;
    if (id === 'freezedry' && defenderTypes.includes('Water') && multiplier !== null) multiplier *= 4;
    if (id === 'flyingpress' && multiplier !== null)
      multiplier *= effectiveness('Flying', defenderTypes, generation) ?? 1;
    return { effectiveness: formatEffectiveness(multiplier) ?? undefined, notes };
  };

  return requestMoves.map((move, index): BattleChoice => {
    const name = move.move || idToName(move.id || `Move ${index + 1}`);
    const data = getMove(move.id || name, generation);
    let type = (move.type || data?.type || 'Normal') as TypeName;
    const id = speciesId(move.id || name);
    if (id === 'terablast' && attacker?.terastallized) type = attacker.terastallized;
    if (id === 'revelationdance' && attacker?.types?.length) type = attacker.types[0];
    if (id === 'weatherball' && weather)
      type =
        (
          {
            sunnyday: 'Fire',
            desolateland: 'Fire',
            raindance: 'Water',
            primordialsea: 'Water',
            sandstorm: 'Rock',
            hail: 'Ice',
            snow: 'Ice',
          } as Record<string, TypeName>
        )[speciesId(weather)] || type;
    const isStatus = (data?.category || 'Status') === 'Status';
    const hint = hintFor(type, data?.category, id);
    const notes = hint.notes;
    if (data?.basePower === 0 && !isStatus) notes.push('Power varies with battle state.');
    const card: BattleChoice = {
      slot: index + 1,
      activeIndex,
      name,
      type,
      pp: `${move.pp ?? data?.pp ?? '-'}/${move.maxpp ?? data?.pp ?? '-'}`,
      ppLeft: move.pp,
      ppMax: move.maxpp ?? data?.pp,
      cmd: `/choose move ${index + 1}${request.rqid ? `|${request.rqid}` : ''}`,
      effectiveness: hint.effectiveness,
      category: data?.category,
      basePower: data?.basePower || undefined,
      accuracy: data?.accuracy,
      description: data?.shortDesc || data?.desc,
      disabled: move.disabled,
      target: move.target || data?.target,
      requiresTarget: normalized.targetable && canChooseTarget(move.target || data?.target),
      targetOptions:
        normalized.targetable && canChooseTarget(move.target || data?.target)
          ? requestTargetOptions(normalized, move.target || data?.target, activeIndex)
          : undefined,
      canMegaEvo: !!activeRequest?.canMegaEvo,
      canUltraBurst: !!activeRequest?.canUltraBurst,
      canZMove: Array.isArray(activeRequest?.zMoves)
        ? !!activeRequest.zMoves[index]
        : !!activeRequest?.canZMove,
      canDynamax: !!activeRequest?.canDynamax,
      canTerastallize: !!activeRequest?.canTerastallize,
      notes,
    };
    const specialCard = (special: BattleRequestSpecialMove, modifier: 'zmove' | 'dynamax'): BattleChoice => {
      const specialData = getMove(special.id || special.move, generation);
      const specialType = (special.type || specialData?.type || type) as TypeName;
      const target = special.target || specialData?.target || card.target;
      const power = modifier === 'zmove' ? data?.zMove?.basePower : data?.maxMove?.basePower;
      return {
        ...card,
        name: special.move || specialData?.name || card.name,
        type: specialType,
        disabled: !!special.disabled,
        modifier,
        cmd: card.cmd.replace(/(\|\d+)?$/, suffix => ` ${modifier}${suffix}`),
        category: specialData?.category || card.category,
        ...hintFor(
          specialType,
          specialData?.category || card.category,
          speciesId(special.id || special.move),
        ),
        basePower:
          power || (specialData?.basePower && specialData.basePower > 1 ? specialData.basePower : undefined),
        accuracy: specialData?.accuracy,
        description: specialData?.shortDesc || specialData?.desc,
        target,
        requiresTarget: normalized.targetable && canChooseTarget(target),
        targetOptions: normalized.targetable
          ? requestTargetOptions(normalized, target, activeIndex)
          : undefined,
      };
    };
    if (activeRequest?.zMoves?.[index]) card.zMove = specialCard(activeRequest.zMoves[index]!, 'zmove');
    if (activeRequest?.maxMoves?.[index])
      card.maxMove = specialCard(activeRequest.maxMoves[index], 'dynamax');
    return card.maxMove && !activeRequest?.canDynamax
      ? { ...card.maxMove, modifier: undefined, cmd: card.cmd, canDynamax: false }
      : card;
  });
}

/** The per-request flags the decision panel needs, without roster rebuild. */
export function requestFlags(request: BattleRequest) {
  const normalized = normalizeBattleRequest(request);
  const activeRequest = normalized.active?.[0];
  return {
    requestType: normalized.requestType,
    noCancel: normalized.noCancel,
    trapped: !!activeRequest?.trapped,
    maybeTrapped: !!activeRequest?.maybeTrapped,
    targetable: normalized.targetable,
    teamPreviewSize: normalized.chosenTeamSize,
  };
}

export function buildBattleCommand(choice: BattleChoice | PokemonSet, rqid?: number) {
  if ('cmd' in choice) return `Queued ${choice.name}.`;
  return choice.fainted
    ? `${choice.name} cannot switch in.`
    : `Queued switch to ${choice.name}${rqid ? ` for request ${rqid}` : ''}.`;
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
  if (choice.kind === 'confirm') return '';
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
  if (choice.kind === 'confirm') return '';
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
  if (choice.max || (active.maxMoves?.length && !active.canDynamax))
    return active.maxMoves?.[choice.slot - 1] || null;
  if (choice.z) return active.zMoves?.[choice.slot - 1] || null;
  return active.moves?.[choice.slot - 1] || null;
};

const fillPasses = (session: BattleChoiceSession) => {
  if (session.request.requestType === 'move') {
    while (
      session.draft.choices.length < (session.request.active?.length || 0) &&
      !session.request.active?.[session.draft.choices.length]
    ) {
      session.draft.choices.push('pass');
    }
  }
  if (session.request.requestType === 'switch') {
    while (
      session.draft.choices.length < (session.request.forceSwitch?.length || 0) &&
      (!session.request.forceSwitch?.[session.draft.choices.length] || !availableSwitches(session).length)
    ) {
      session.draft.choices.push('pass');
    }
  }
};

export function isReviving(session: BattleChoiceSession): boolean {
  return (
    session.request.requestType === 'switch' &&
    !!session.request.side?.pokemon?.[choiceIndex(session)]?.reviving
  );
}

export function availableSwitches(session: BattleChoiceSession): number[] {
  const revival = isReviving(session);
  return (session.request.side?.pokemon || []).flatMap((pokemon, index) => {
    const fainted = pokemon.condition.includes('fnt');
    return (!revival && index < requestLength(session.request)) ||
      fainted !== revival ||
      session.alreadySwitchingIn.includes(index + 1)
      ? []
      : [index + 1];
  });
}

export function canPassBattleChoice(session: BattleChoiceSession): boolean {
  if (session.status === 'submitted' || session.request.requestType !== 'switch' || isReviving(session))
    return false;
  const remaining = (session.request.forceSwitch || []).slice(choiceIndex(session)).filter(Boolean).length;
  return remaining > availableSwitches(session).length;
}

export function canShiftBattleChoice(session: BattleChoiceSession): boolean {
  return (
    session.request.gameType === 'triples' &&
    session.request.requestType === 'move' &&
    session.status !== 'submitted' &&
    session.status !== 'cancelling' &&
    !session.draft.pendingMove &&
    choiceIndex(session) !== 1 &&
    !!currentMoveRequest(session)
  );
}

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
    status: 'drafting',
  };
  fillPasses(session);
  return session;
}

export function isBattleChoiceComplete(session: BattleChoiceSession) {
  return !session.draft.pendingMove && session.draft.choices.length >= requestLength(session.request);
}

export function addBattleChoice(
  session: BattleChoiceSession,
  choice: BattleChoiceState,
): BattleCommandResult {
  const next = cloneSession(session);
  const reject = (error: string): BattleCommandResult => ({
    ok: false,
    complete: false,
    error,
    draft: next.draft,
    session: next,
  });

  if (next.status === 'submitted' || next.status === 'cancelling')
    return reject('Your choice is already submitted. Cancel it before choosing again.');
  if (isBattleChoiceComplete(next) && choice.kind !== 'confirm' && choice.kind !== 'team')
    return reject('All positions already have a choice.');

  if (next.request.requestType === 'wait') {
    return {
      ok: false,
      complete: false,
      error: "It's not your turn to choose.",
      draft: next.draft,
      session: next,
    };
  }

  if (choice.kind === 'confirm') {
    if (next.request.requestType !== 'team' || !isBattleChoiceComplete(next))
      return reject('Choose the required team order before confirming.');
  } else if (choice.kind === 'pass') {
    if (!canPassBattleChoice(next)) return reject('This position needs a Pokémon.');
    next.draft.choices.push('pass');
  } else if (choice.kind === 'shift') {
    if (!canShiftBattleChoice(next))
      return reject('Only an active Pokémon at the edge of a triples battle can shift to the center.');
    next.draft.choices.push('shift');
  } else if (choice.kind === 'team') {
    if (next.request.requestType !== 'team') {
      return {
        ok: false,
        complete: false,
        error: 'Team preview is not active.',
        draft: next.draft,
        session: next,
      };
    }
    // A preview click toggles a slot. An explicit order replaces the draft,
    // allowing the preview editor to reorder without submitting prematurely.
    const targetSlots = choice.order;
    if (targetSlots.length !== 1) {
      next.draft.choices = [];
      next.alreadySwitchingIn = [];
    }
    for (const slot of targetSlots) {
      const pokemon = next.request.side?.pokemon?.[slot - 1];
      if (!pokemon)
        return {
          ok: false,
          complete: false,
          error: `Team slot ${slot} is unavailable.`,
          draft: next.draft,
          session: next,
        };
      if (pokemon.condition.includes('fnt'))
        return {
          ok: false,
          complete: false,
          error: `${pokemon.ident} has fainted.`,
          draft: next.draft,
          session: next,
        };
      if (next.alreadySwitchingIn.includes(slot)) {
        const index = next.alreadySwitchingIn.indexOf(slot);
        next.alreadySwitchingIn.splice(index, 1);
        next.draft.choices.splice(index, 1);
        continue;
      }
      if (isBattleChoiceComplete(next))
        return reject('Your selection is full. Remove a Pokémon to choose another.');
      next.alreadySwitchingIn.push(slot);
      next.draft.choices.push(`team ${slot}`);
      if (isBattleChoiceComplete(next)) break;
    }
  } else if (choice.kind === 'switch') {
    if (next.request.requestType !== 'switch' && next.request.requestType !== 'move') {
      return {
        ok: false,
        complete: false,
        error: 'Switching is not available for this request.',
        draft: next.draft,
        session: next,
      };
    }
    if (currentMoveRequest(next)?.trapped) {
      return {
        ok: false,
        complete: false,
        error: 'You are trapped and cannot switch out.',
        draft: next.draft,
        session: next,
      };
    }
    const pokemon = next.request.side?.pokemon?.[choice.slot - 1];
    if (!pokemon)
      return {
        ok: false,
        complete: false,
        error: `Switch slot ${choice.slot} is unavailable.`,
        draft: next.draft,
        session: next,
      };
    const revival = isReviving(next);
    if (!revival && choice.slot - 1 < requestLength(next.request)) {
      return {
        ok: false,
        complete: false,
        error: 'That Pokemon is already active.',
        draft: next.draft,
        session: next,
      };
    }
    if (pokemon.condition.includes('fnt') !== revival) {
      if (revival) return reject('Choose a fainted Pokémon to revive.');
      return {
        ok: false,
        complete: false,
        error: `${pokemon.ident} has fainted.`,
        draft: next.draft,
        session: next,
      };
    }
    if (next.alreadySwitchingIn.includes(choice.slot)) {
      return {
        ok: false,
        complete: false,
        error: 'That Pokemon is already selected.',
        draft: next.draft,
        session: next,
      };
    }
    next.alreadySwitchingIn.push(choice.slot);
    next.draft.choices.push(`switch ${choice.slot}`);
    if (currentMoveRequest(session)?.maybeTrapped && next.draft.choices.length >= requestLength(next.request))
      next.noCancel = true;
  } else if (choice.kind === 'move') {
    if (next.request.requestType !== 'move') {
      return {
        ok: false,
        complete: false,
        error: 'You must switch, not move.',
        draft: next.draft,
        session: next,
      };
    }
    if (choice.activeIndex !== undefined && choice.activeIndex !== choiceIndex(next))
      return reject('This move belongs to an earlier position. Choose the current Pokémon’s action.');
    const active = currentMoveRequest(next);
    const move = currentMove(next, choice);
    if (!active || !move || move.disabled) {
      return {
        ok: false,
        complete: false,
        error: `Move ${move?.move || choice.slot} is disabled.`,
        draft: next.draft,
        session: next,
      };
    }
    if (choice.max && !active.canDynamax) choice = { ...choice, max: false };
    if (choice.mega && !active.canMegaEvo) return reject('Mega Evolution is unavailable.');
    if (choice.ultra && !active.canUltraBurst) return reject('Ultra Burst is unavailable.');
    if (choice.tera && !active.canTerastallize) return reject('Terastallization is unavailable.');
    if ([choice.mega, choice.ultra, choice.z, choice.max, choice.tera].filter(Boolean).length > 1)
      return reject('Choose one transformation for this action.');
    if (choice.mega && next.alreadyMega)
      return {
        ok: false,
        complete: false,
        error: 'Mega Evolution is already selected.',
        draft: next.draft,
        session: next,
      };
    if (choice.z && next.alreadyZ)
      return {
        ok: false,
        complete: false,
        error: 'A Z-Move is already selected.',
        draft: next.draft,
        session: next,
      };
    if (choice.max && next.alreadyMax)
      return {
        ok: false,
        complete: false,
        error: 'Dynamax is already selected.',
        draft: next.draft,
        session: next,
      };
    if (choice.tera && next.alreadyTera)
      return {
        ok: false,
        complete: false,
        error: 'Terastallization is already selected.',
        draft: next.draft,
        session: next,
      };
    if (next.request.targetable && canChooseTarget(move.target) && !choice.target) {
      next.draft.pendingMove = choice;
      return { ok: true, complete: false, draft: next.draft, session: next, message: 'Choose a target.' };
    }
    if (
      choice.target &&
      (!next.request.targetable ||
        !requestTargetOptions(next.request, move.target, choiceIndex(next)).includes(choice.target))
    )
      return reject('That target is unavailable for this move.');
    if (choice.mega) next.alreadyMega = true;
    if (choice.z) next.alreadyZ = true;
    if (choice.max) next.alreadyMax = true;
    if (choice.tera) next.alreadyTera = true;
    next.draft.pendingMove = undefined;
    next.draft.choices.push(stringChoice(choice) as string);
    if (
      active.maybeDisabled &&
      !next.request.targetable &&
      next.draft.choices.length >= requestLength(next.request)
    )
      next.noCancel = true;
  }

  fillPasses(next);
  const complete = isBattleChoiceComplete(next);
  const choiceString = next.draft.choices.join(', ').replace(/, team /g, ', ');
  const command =
    complete && (next.request.requestType !== 'team' || choice.kind === 'confirm')
      ? `/choose ${choiceString}${next.request.rqid ? `|${next.request.rqid}` : ''}`
      : undefined;
  if (command) next.status = 'submitted';
  return { ok: true, complete, command, draft: next.draft, session: next };
}

/** The server's saved choice is authoritative after reconnect or /undo. */
export function restoreBattleChoiceSession(request: BattleRequest, serialized: string): BattleChoiceSession {
  const session = createBattleChoiceSession(request);
  if (!serialized.trim()) return session;
  session.draft.choices = serialized
    .trim()
    .split(',')
    .map(choice => choice.trim());
  session.status = 'submitted';
  return session;
}

export function battleDecisionState(
  roomId: string,
  battle: ArenaBattle,
  session?: BattleChoiceSession,
  error?: string,
): BattleDecisionState {
  return {
    roomId,
    mode: battle.mode || (battle.requestType === 'wait' ? 'waiting' : 'player'),
    requestType: battle.requestType,
    requestLength: session
      ? requestLength(session.request)
      : battle.requestType === 'team'
        ? battle.teamPreviewSize || 1
        : 0,
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
