export type PokemonSet = {
  slot: number;
  name: string;
  species: string;
  hp: number;
  status?: 'BRN' | 'PAR' | 'PSN' | 'SLP' | 'FRZ';
  active?: boolean;
  fainted?: boolean;
};

export type BattleRoomMode = 'player' | 'spectator' | 'waiting' | 'ended';

export type BattleChoice = {
  slot: number;
  activeIndex?: number;
  name: string;
  type: 'Fire' | 'Water' | 'Grass' | 'Electric' | 'Ground' | 'Dark' | 'Fairy' | 'Fighting' | 'Normal' | 'Psychic' | 'Steel' | 'Poison' | 'Ice' | 'Bug' | 'Flying' | 'Rock' | 'Ghost' | 'Dragon';
  pp: string;
  cmd: string;
  effectiveness: string;
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

export const demoBattle: ArenaBattle = {
  id: 'demo-gen9ou',
  format: 'Gen 9 OU',
  turn: 12,
  p1: { name: 'You', rating: 1516 },
  p2: { name: 'Rival', rating: 1498 },
  active: { slot: 1, name: 'Iron Valiant', species: 'ironvaliant', hp: 72, active: true },
  opponentActive: { slot: 1, name: 'Great Tusk', species: 'greattusk', hp: 44, active: true },
  team: [
    { slot: 1, name: 'Iron Valiant', species: 'ironvaliant', hp: 72, active: true },
    { slot: 2, name: 'Dragapult', species: 'dragapult', hp: 100 },
    { slot: 3, name: 'Kingambit', species: 'kingambit', hp: 64, status: 'BRN' },
    { slot: 4, name: 'Rotom-Wash', species: 'rotomwash', hp: 38 },
    { slot: 5, name: 'Amoonguss', species: 'amoonguss', hp: 0, fainted: true },
    { slot: 6, name: 'Heatran', species: 'heatran', hp: 88 },
  ],
  opponentTeam: [
    { slot: 1, name: 'Great Tusk', species: 'greattusk', hp: 44, active: true },
    { slot: 2, name: 'Gholdengo', species: 'gholdengo', hp: 91 },
    { slot: 3, name: 'Samurott-Hisui', species: 'samurotthisui', hp: 0, fainted: true },
    { slot: 4, name: 'Dragonite', species: 'dragonite', hp: 100 },
    { slot: 5, name: 'Slowking-Galar', species: 'slowkinggalar', hp: 57, status: 'PAR' },
    { slot: 6, name: 'Enamorus', species: 'enamorus', hp: 84 },
  ],
  moves: [
    { slot: 1, name: 'Moonblast', type: 'Fairy', pp: '11/16', cmd: '/move 1', effectiveness: '2x' },
    { slot: 2, name: 'Close Combat', type: 'Fighting', pp: '7/8', cmd: '/move 2', effectiveness: '1x' },
    { slot: 3, name: 'Thunderbolt', type: 'Electric', pp: '15/24', cmd: '/move 3', effectiveness: '1x' },
    { slot: 4, name: 'Encore', type: 'Dark', pp: '5/8', cmd: '/move 4', effectiveness: 'status' },
  ],
  log: [
    'Turn 12 started.',
    'Pointed stones dug into Great Tusk.',
    'Iron Valiant awaits your command.',
    'The opposing team still has four Pokemon remaining.',
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

const typeFromMoveName = (name: string): BattleChoice['type'] => {
  const lower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (lower.includes('moonblast')) return 'Fairy';
  if (lower.includes('closecombat')) return 'Fighting';
  if (lower.includes('thunder')) return 'Electric';
  if (lower.includes('shadow')) return 'Ghost';
  if (lower.includes('ice')) return 'Ice';
  if (lower.includes('poison')) return 'Poison';
  if (lower.includes('iron') || lower.includes('steel')) return 'Steel';
  if (lower.includes('dragon')) return 'Dragon';
  if (lower.includes('bug')) return 'Bug';
  if (lower.includes('rock')) return 'Rock';
  if (lower.includes('fly') || lower.includes('hurricane')) return 'Flying';
  if (lower.includes('water') || lower.includes('hydro') || lower.includes('surf')) return 'Water';
  if (lower.includes('fire') || lower.includes('flame') || lower.includes('burn')) return 'Fire';
  if (lower.includes('grass') || lower.includes('leaf') || lower.includes('giga')) return 'Grass';
  if (lower.includes('earth') || lower.includes('ground')) return 'Ground';
  if (lower.includes('psychic')) return 'Psychic';
  if (lower.includes('dark') || lower.includes('sucker')) return 'Dark';
  return 'Normal';
};

const idToName = (id: string) => id
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[-_]/g, ' ')
  .replace(/\b\w/g, letter => letter.toUpperCase());

const speciesFromDetails = (details: string) => details.split(',')[0]?.trim() || 'Pokemon';

const speciesId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export function parseHpPercent(condition: string) {
  if (!condition || condition === '0 fnt') return 0;
  const [hpPart] = condition.split(' ');
  if (hpPart.includes('/')) {
    const [hp, maxhp] = hpPart.split('/').map(Number);
    if (maxhp > 0) return Math.max(0, Math.min(100, Math.round((hp / maxhp) * 100)));
  }
  const numeric = Number(hpPart);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 100;
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

export function battleFromRequest(roomId: string, request: BattleRequest, previous: ArenaBattle = emptyBattle): ArenaBattle {
  const normalized = normalizeBattleRequest(request, previous);
  const playerSide = request.side?.id === 'p2' ? 'p2' : request.side?.id === 'p1' ? 'p1' : previous.playerSide;
  const team = request.side?.pokemon?.map((pokemon, index): PokemonSet => {
    const name = pokemon.ident.split(': ')[1] || speciesFromDetails(pokemon.details);
    return {
      slot: index + 1,
      name,
      species: speciesId(speciesFromDetails(pokemon.details)),
      hp: parseHpPercent(pokemon.condition),
      active: !!pokemon.active,
      fainted: pokemon.condition.includes('fnt') || parseHpPercent(pokemon.condition) <= 0,
      status: pokemon.condition.includes(' brn') ? 'BRN' :
        pokemon.condition.includes(' par') ? 'PAR' :
        pokemon.condition.includes(' psn') ? 'PSN' :
        pokemon.condition.includes(' slp') ? 'SLP' :
        pokemon.condition.includes(' frz') ? 'FRZ' : undefined,
    };
  }) || previous.team;

  const active = team.find(pokemon => pokemon.active) || team[0] || previous.active;
  const activeRequest = normalized.active?.[0];
  const requestMoves = activeRequest?.moves || [];
  const moves = requestMoves.length ? requestMoves.map((move, index): BattleChoice => ({
    slot: index + 1,
    activeIndex: 0,
    name: move.move || idToName(move.id || `Move ${index + 1}`),
    type: move.type || typeFromMoveName(move.move || move.id || ''),
    pp: `${move.pp ?? '-'} / ${move.maxpp ?? '-'}`.replaceAll(' ', ''),
    cmd: `/choose move ${index + 1}${request.rqid ? `|${request.rqid}` : ''}`,
    effectiveness: move.disabled ? 'disabled' : 'ready',
    disabled: move.disabled,
    target: move.target,
    requiresTarget: normalized.targetable && canChooseTarget(move.target),
    targetOptions: normalized.targetable && canChooseTarget(move.target) ? defaultTargetOptions(move.target) : undefined,
    canMegaEvo: !!activeRequest?.canMegaEvo,
    canUltraBurst: !!activeRequest?.canUltraBurst,
    canZMove: Array.isArray(activeRequest?.zMoves) ? !!activeRequest.zMoves[index] : !!activeRequest?.canZMove,
    canDynamax: !!activeRequest?.canDynamax,
    canTerastallize: !!activeRequest?.canTerastallize,
  })) : previous.moves;

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

const statusFromCondition = (condition: string): PokemonSet['status'] => {
  if (condition.includes(' brn')) return 'BRN';
  if (condition.includes(' par')) return 'PAR';
  if (condition.includes(' psn') || condition.includes(' tox')) return 'PSN';
  if (condition.includes(' slp')) return 'SLP';
  if (condition.includes(' frz')) return 'FRZ';
  return undefined;
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

const conditionPatch = (condition: string): Partial<PokemonSet> => {
  const hp = parseHpPercent(condition);
  return {
    hp,
    status: statusFromCondition(condition),
    fainted: condition.includes('fnt') || hp <= 0,
  };
};

const updatePokemonFromIdent = (
  battle: ArenaBattle,
  identText: string,
  patch: Partial<PokemonSet>,
  species?: string
): ArenaBattle => {
  const ident = protocolIdent(identText);
  if (!ident) return battle;
  const ownSide = battle.playerSide || 'p1';
  const isOwn = ident.side === ownSide;
  const activeKey = isOwn ? 'active' : 'opponentActive';
  const rosterKey = isOwn ? 'team' : 'opponentTeam';
  const active = battle[activeKey];
  const nextActive = samePokemon(active, ident.name, species) ? { ...active, ...patch } : active;
  return {
    ...battle,
    [activeKey]: nextActive,
    [rosterKey]: updateRosterPokemon(battle[rosterKey], ident.name, patch, species),
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
  const species = speciesId(speciesFromDetails(details));
  const patch: Partial<PokemonSet> = {
    ...conditionPatch(condition),
    active: true,
    name: ident.name,
    species,
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
    hp: parseHpPercent(condition),
    active: true,
  };
  return { ...battle, [activeKey]: active, [rosterKey]: roster };
};

const conditionLabel = (raw: string) => raw
  .replace(/^move:\s*/i, '')
  .replace(/^ability:\s*/i, '')
  .replace(/^item:\s*/i, '');

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
    return updatePokemonFromIdent(battle, args[0] || '', conditionPatch(args[1] || ''));
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
    const name = speciesFromDetails(args[1] || 'Pokemon');
    if (battle[rosterKey].some(pokemon => speciesId(pokemon.species) === speciesId(name))) return battle;
    return {
      ...battle,
      [rosterKey]: [...battle[rosterKey], {
        slot: battle[rosterKey].length + 1,
        name,
        species: speciesId(name),
        hp: 100,
      }],
    };
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
