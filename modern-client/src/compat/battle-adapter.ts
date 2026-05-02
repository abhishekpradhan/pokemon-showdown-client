export type PokemonSet = {
  slot: number;
  name: string;
  species: string;
  hp: number;
  status?: 'BRN' | 'PAR' | 'PSN' | 'SLP' | 'FRZ';
  active?: boolean;
  fainted?: boolean;
};

export type BattleChoice = {
  name: string;
  type: 'Fire' | 'Water' | 'Grass' | 'Electric' | 'Ground' | 'Dark' | 'Fairy' | 'Fighting' | 'Normal' | 'Psychic' | 'Steel' | 'Poison' | 'Ice' | 'Bug' | 'Flying' | 'Rock' | 'Ghost' | 'Dragon';
  pp: string;
  cmd: string;
  effectiveness: string;
  disabled?: boolean;
  target?: string;
};

export type ArenaBattle = {
  id: string;
  format: string;
  turn: number;
  p1: { name: string; rating: number };
  p2: { name: string; rating: number };
  active: PokemonSet;
  opponentActive: PokemonSet;
  team: PokemonSet[];
  opponentTeam: PokemonSet[];
  moves: BattleChoice[];
  log: string[];
  chat: { user: string; message: string }[];
  rqid?: number;
  requestType?: 'move' | 'switch' | 'team' | 'wait';
  waiting?: boolean;
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
    trapped?: boolean;
    maybeTrapped?: boolean;
    canMegaEvo?: boolean;
    canUltraBurst?: boolean;
    canZMove?: unknown;
    canDynamax?: boolean;
    canTerastallize?: string;
  }>;
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
    { name: 'Moonblast', type: 'Fairy', pp: '11/16', cmd: '/move 1', effectiveness: '2x' },
    { name: 'Close Combat', type: 'Fighting', pp: '7/8', cmd: '/move 2', effectiveness: '1x' },
    { name: 'Thunderbolt', type: 'Electric', pp: '15/24', cmd: '/move 3', effectiveness: '1x' },
    { name: 'Encore', type: 'Dark', pp: '5/8', cmd: '/move 4', effectiveness: 'status' },
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
  if (request.wait) return 'wait';
  if (request.teamPreview) return 'team';
  if (request.forceSwitch) return 'switch';
  return 'move';
}

export function battleFromRequest(roomId: string, request: BattleRequest, previous: ArenaBattle = demoBattle): ArenaBattle {
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
  const requestMoves = request.active?.[0]?.moves || [];
  const moves = requestMoves.length ? requestMoves.map((move, index): BattleChoice => ({
    name: move.move || idToName(move.id || `Move ${index + 1}`),
    type: move.type || typeFromMoveName(move.move || move.id || ''),
    pp: `${move.pp ?? '-'} / ${move.maxpp ?? '-'}`.replaceAll(' ', ''),
    cmd: `/choose move ${index + 1}${request.rqid ? `|${request.rqid}` : ''}`,
    effectiveness: move.disabled ? 'disabled' : 'ready',
    disabled: move.disabled,
    target: move.target,
  })) : previous.moves;

  return {
    ...previous,
    id: roomId || previous.id,
    rqid: request.rqid,
    requestType: requestType(request),
    waiting: !!request.wait,
    p1: { ...previous.p1, name: request.side?.name || previous.p1.name },
    active,
    team,
    moves,
  };
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
