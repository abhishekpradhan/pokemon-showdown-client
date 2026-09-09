// dex.ts wraps the lazily-loaded @pkmn chunk; importing it statically is
// cheap and the checks below no-op until loadDex() has run somewhere.
import { getAbility, getItem, getMove, getSpecies, isDexLoaded } from '../data/dex';
import { toId } from './protocol-parsers';

export type StatTable = Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;

export type TeamSet = {
  name?: string;
  species: string;
  item?: string;
  ability?: string;
  moves: string[];
  nature?: string;
  evs?: StatTable;
  ivs?: StatTable;
  gender?: string;
  shiny?: boolean;
  level?: number;
  happiness?: number;
  teraType?: string;
  hpType?: string;
  pokeball?: string;
  gigantamax?: boolean;
  dynamaxLevel?: number;
};

export type StoredTeam = {
  id: string;
  name: string;
  format: string;
  folder?: string;
  packed: string;
  sets: TeamSet[];
  updatedAt: number;
};

export type TeamValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type PackedTeam = string;

export const TEAM_STORAGE_KEY = 'ps-modern-teams-v1';

const statOrder = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

const displayName = (value: string) =>
  value.replace(/[-_]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());

const parseStats = (value: string): StatTable | undefined => {
  if (!value) return undefined;
  const stats: StatTable = {};
  for (const part of value.split('/')) {
    const match = part.trim().match(/^(\d+)\s+([A-Za-z]+)/);
    if (!match) continue;
    const key =
      match[2].toLowerCase() === 'spatk'
        ? 'spa'
        : match[2].toLowerCase() === 'spdef'
          ? 'spd'
          : (match[2].toLowerCase() as keyof StatTable);
    if (statOrder.includes(key as (typeof statOrder)[number])) stats[key] = Number(match[1]);
  }
  return Object.keys(stats).length ? stats : undefined;
};

const statsToPacked = (stats?: StatTable, defaultValue?: number) => {
  if (!stats) return '';
  const values = statOrder.map(stat => {
    const value = stats[stat];
    if (defaultValue !== undefined && (value === undefined || value === defaultValue)) return '';
    return value ?? '';
  });
  return values.every(value => value === '') ? '' : values.join(',');
};

export function packTeam(team: TeamSet[] | PackedTeam): PackedTeam {
  if (typeof team === 'string') return team.trim();
  return team
    .map(set => {
      const speciesId = toId(set.species);
      const name = (set.name || set.species).replace(/[|\]\r\n]/g, '');
      const parts = [
        name,
        toId(name) === speciesId ? '' : speciesId,
        toId(set.item || ''),
        /^[01HS]$/.test(set.ability || '') ? set.ability : toId(set.ability || ''),
        set.moves.map(toId).filter(Boolean).join(','),
        (set.nature || '').replace(/[|\]\r\n]/g, ''),
        statsToPacked(set.evs),
        set.gender || '',
        statsToPacked(set.ivs, 31),
        set.shiny ? 'S' : '',
        set.level && set.level !== 100 ? String(set.level) : '',
      ];
      const misc = [
        set.happiness !== undefined && set.happiness !== 255 ? String(set.happiness) : '',
        set.hpType || '',
        toId(set.pokeball || ''),
        set.gigantamax ? 'G' : '',
        set.dynamaxLevel !== undefined && set.dynamaxLevel !== 10 ? String(set.dynamaxLevel) : '',
        set.teraType || '',
      ];
      return `${parts.join('|')}|${misc.some(Boolean) ? misc.join(',') : ''}`;
    })
    .join(']');
}

export function unpackTeam(packed: PackedTeam): TeamSet[] {
  if (!packed.trim()) return [];
  return packed
    .trim()
    .split(']')
    .filter(Boolean)
    .map(chunk => {
      const parts = chunk.split('|');
      const species =
        getSpecies(parts[1] || parts[0])?.name || displayName(parts[1] || parts[0] || 'Pokemon');
      const abilityCode = parts[3] || '0';
      const ability = /^[01HS]$/.test(abilityCode)
        ? getSpecies(species)?.abilities[abilityCode as '0'] || abilityCode
        : getAbility(abilityCode)?.name || displayName(abilityCode);
      const evValues = (parts[6] || '').split(',');
      const ivValues = (parts[8] || '').split(',');
      const misc = (parts[11] || '').split(',');
      const evs =
        evValues.length > 1
          ? (Object.fromEntries(
              statOrder.map((stat, index) => [stat, Number(evValues[index]) || 0]),
            ) as StatTable)
          : undefined;
      const ivs =
        ivValues.length > 1
          ? (Object.fromEntries(
              statOrder.map((stat, index) => [stat, ivValues[index] === '' ? 31 : Number(ivValues[index])]),
            ) as StatTable)
          : undefined;

      return {
        name: parts[1] && parts[0] !== species ? parts[0] : undefined,
        species,
        item: parts[2] ? displayName(parts[2]) : undefined,
        ability: parts[3] || getSpecies(species) ? ability : undefined,
        moves: (parts[4] || '').split(',').filter(Boolean).map(displayName),
        nature: parts[5] || undefined,
        evs,
        gender: parts[7] || undefined,
        ivs,
        shiny: parts[9] === 'S',
        level: parts[10] ? Number(parts[10]) : undefined,
        happiness: misc[0] ? Number(misc[0]) : undefined,
        hpType: misc[1] || undefined,
        pokeball: misc[2] || undefined,
        gigantamax: misc[3] === 'G' || undefined,
        dynamaxLevel: misc[4] !== undefined && misc[4] !== '' ? Number(misc[4]) : undefined,
        teraType: misc[5] || undefined,
      };
    });
}

export function importTeam(text: string): TeamSet[] {
  const normalized = text.trim().replace(/\r\n/g, '\n');
  if (!normalized) return [];
  if (!normalized.includes('\n') && normalized.includes('|')) return unpackTeam(normalized);

  const sets: TeamSet[] = [];
  let current: TeamSet | null = null;

  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    if (!line || line === '---') {
      current = null;
      continue;
    }

    if (!current) {
      const atIndex = line.lastIndexOf(' @ ');
      let nameLine = atIndex >= 0 ? line.slice(0, atIndex) : line;
      const gender = nameLine.match(/ \(([MF])\)$/)?.[1];
      if (gender) nameLine = nameLine.slice(0, -4);
      const item = atIndex >= 0 ? line.slice(atIndex + 3) : undefined;
      const speciesMatch = nameLine.match(/^(.*?)\s+\((.*?)\)$/);
      current = {
        name: speciesMatch ? speciesMatch[1] : undefined,
        gender,
        species: speciesMatch ? speciesMatch[2] : nameLine,
        item,
        moves: [],
      };
      sets.push(current);
      continue;
    }

    if (line.startsWith('Happiness: ')) current.happiness = Number(line.slice(11));
    else if (line.startsWith('Gender: ')) current.gender = line.slice(8);
    else if (line.startsWith('Pokeball: ')) current.pokeball = line.slice(10);
    else if (line.startsWith('Hidden Power: ')) current.hpType = line.slice(14);
    else if (line.startsWith('Dynamax Level: ')) current.dynamaxLevel = Number(line.slice(15));
    else if (line === 'Gigantamax: Yes') current.gigantamax = true;
    else if (line.startsWith('Trait: ')) current.ability = line.slice(7);
    else if (line.startsWith('[') && line.endsWith(']')) current.ability = line.slice(1, -1);
    else if (line.startsWith('Ability: ')) current.ability = line.slice(9);
    else if (line.startsWith('Level: ')) current.level = Number(line.slice(7)) || undefined;
    else if (line.startsWith('Tera Type: ')) current.teraType = line.slice(11);
    else if (line === 'Shiny: Yes') current.shiny = true;
    else if (line.startsWith('EVs: ')) current.evs = parseStats(line.slice(5));
    else if (line.startsWith('IVs: ')) current.ivs = parseStats(line.slice(5));
    else if (line.endsWith(' Nature')) current.nature = line.slice(0, -7);
    else if (/^[-~] /.test(line)) {
      const move = line.slice(2).replace(/Hidden Power \[([^\]]+)\]/, 'Hidden Power $1');
      current.moves.push(move);
      if (move.startsWith('Hidden Power ')) current.hpType = move.slice(13);
      if (move === 'Frustration' && current.happiness === undefined) current.happiness = 0;
    }
  }

  return sets;
}

export function exportTeam(team: TeamSet[] | PackedTeam): string {
  const sets = typeof team === 'string' ? unpackTeam(team) : team;
  return sets
    .map(set => {
      const title = `${set.name && set.name !== set.species ? `${set.name} (${set.species})` : set.species}${set.gender === 'M' || set.gender === 'F' ? ` (${set.gender})` : ''}${set.item ? ` @ ${set.item}` : ''}`;
      const lines = [
        title,
        set.ability ? `Ability: ${set.ability}` : '',
        set.level ? `Level: ${set.level}` : '',
        set.shiny ? 'Shiny: Yes' : '',
        set.gender && set.gender !== 'M' && set.gender !== 'F' ? `Gender: ${set.gender}` : '',
        set.teraType ? `Tera Type: ${set.teraType}` : '',
        set.happiness !== undefined ? `Happiness: ${set.happiness}` : '',
        set.hpType ? `Hidden Power: ${set.hpType}` : '',
        set.pokeball ? `Pokeball: ${set.pokeball}` : '',
        set.gigantamax ? 'Gigantamax: Yes' : '',
        set.dynamaxLevel !== undefined ? `Dynamax Level: ${set.dynamaxLevel}` : '',
        set.evs
          ? `EVs: ${statOrder.map(stat => `${set.evs?.[stat] || 0} ${stat.toUpperCase()}`).join(' / ')}`
          : '',
        set.nature ? `${set.nature} Nature` : '',
        set.ivs
          ? `IVs: ${statOrder.map(stat => `${set.ivs?.[stat] ?? 31} ${stat.toUpperCase()}`).join(' / ')}`
          : '',
        ...set.moves.map(move => `- ${move}`),
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n\n');
}

export function importTeams(text: string, format = 'gen9ou'): StoredTeam[] {
  const normalized = text.trim().replace(/\r\n/g, '\n');
  if (!normalized) return [];
  if (!normalized.startsWith('===')) {
    const sets = importTeam(normalized);
    const name = sets[0]?.species ? `${sets[0].species} team` : 'Imported team';
    return [
      {
        id: `${toId(name)}-${Date.now()}`,
        name,
        format,
        sets,
        packed: packTeam(sets),
        updatedAt: Date.now(),
      },
    ];
  }

  const teams: StoredTeam[] = [];
  const blocks = normalized.split(/\n(?====)/g);
  for (const block of blocks) {
    const [header = '', ...body] = block.split('\n');
    const title = header
      .replace(/^===\s*/, '')
      .replace(/\s*===$/, '')
      .trim();
    const bracket = title.match(/^\[(.*?)\]\s*(.*)$/);
    const teamFormat = bracket?.[1] ? toId(bracket[1]) : format;
    const fullName = bracket?.[2] || title || 'Imported team';
    const slash = fullName.lastIndexOf('/');
    const folder = slash >= 0 ? fullName.slice(0, slash) : '';
    const name = slash >= 0 ? fullName.slice(slash + 1) : fullName;
    const sets = importTeam(body.join('\n'));
    teams.push({
      id: `${toId(name)}-${Date.now()}-${teams.length}`,
      name,
      folder,
      format: teamFormat,
      sets,
      packed: packTeam(sets),
      updatedAt: Date.now(),
    });
  }
  return teams;
}

/** The in-game cap on total EVs; the PS validator enforces it for gen 3+. */
const MAX_EV_TOTAL = 510;

export function validateTeamSets(sets: TeamSet[], format = 'gen9ou'): TeamValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!sets.length) errors.push('Add at least one Pokemon.');

  // Dex-backed checks are warnings, never errors: the server's team validator
  // is the authority, and blocking a team that's legal in some format the
  // local dex doesn't model (past gens, mods) would be worse than a nudge.
  const dexReady = isDexLoaded();
  const generation = Number(/^gen(\d)/.exec(format)?.[1]) || 9;
  const seenSpecies = new Map<string, string>();

  sets.forEach((set, index) => {
    const label = set.species || set.name || `Pokemon ${index + 1}`;
    if (!set.species.trim()) errors.push(`${label} is missing a species.`);
    if (!set.moves.filter(Boolean).length) errors.push(`${label} needs at least one move.`);
    if (set.moves.filter(Boolean).length > 4)
      warnings.push(`${label} has more than four moves; only legal moves will be accepted by the server.`);

    const evTotal = Object.values(set.evs || {}).reduce((total, value) => total + (value || 0), 0);
    if (generation > 2 && evTotal > MAX_EV_TOTAL)
      warnings.push(`${label} has ${evTotal} EVs; the limit is ${MAX_EV_TOTAL}.`);

    if (set.species.trim()) {
      const speciesKey = toId(set.species);
      const first = seenSpecies.get(speciesKey);
      if (first) warnings.push(`${label} duplicates ${first}; Species Clause formats reject this.`);
      else seenSpecies.set(speciesKey, label);
    }

    if (dexReady) {
      if (set.species.trim() && !getSpecies(set.species, generation)) {
        warnings.push(`${label}: species not found in the Gen ${generation} Pokédex.`);
      }
      for (const move of set.moves.filter(Boolean)) {
        if (!getMove(move, generation)) warnings.push(`${label}: unknown move "${move}".`);
      }
      if (set.ability && !getAbility(set.ability, generation))
        warnings.push(`${label}: unknown ability "${set.ability}".`);
      if (set.item && !getItem(set.item, generation)) warnings.push(`${label}: unknown item "${set.item}".`);
    }
  });

  if (sets.length > 6) warnings.push('Teams above six Pokemon may be rejected by standard formats.');

  return { ok: errors.length === 0, errors, warnings };
}

export function validateStoredTeam(team: StoredTeam | undefined): TeamValidationResult {
  if (!team) return { ok: false, errors: ['Select or import a team.'], warnings: [] };
  return validateTeamSets(team.sets);
}

export function importPackedTeam(text: string): PackedTeam {
  return packTeam(importTeam(text));
}

export function exportPackedTeam(team: PackedTeam): string {
  return packTeam(team);
}

export type StorageResult = { ok: true } | { ok: false; error: string; conflict?: boolean };
type LibraryEnvelope = { version: 2; revision: string; teams: StoredTeam[] };
export type TeamDraft = {
  key: string;
  teamId?: string;
  baseUpdatedAt?: number;
  name: string;
  format: string;
  folder: string;
  sets: TeamSet[];
  updatedAt: number;
};
const DRAFT_PREFIX = 'ps-arena-team-draft-';
const RECOVERY_KEY = 'ps-arena-team-recovery';
let librarySnapshot: string | null | undefined;
let storageProblem = '';
const draftSnapshots = new Map<string, string | null>();
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const numericFields = ['level', 'happiness', 'dynamaxLevel'] as const;
const stringFields = [
  'name',
  'item',
  'ability',
  'nature',
  'gender',
  'teraType',
  'hpType',
  'pokeball',
] as const;

export const createTeamId = () =>
  globalThis.crypto?.randomUUID?.() || `team-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Validate every record before it reaches the app, retaining unknown input for recovery. */
export function parseTeamSet(value: unknown): TeamSet | undefined {
  if (
    !isRecord(value) ||
    typeof value.species !== 'string' ||
    !Array.isArray(value.moves) ||
    !value.moves.every(move => typeof move === 'string')
  )
    return;
  const set: TeamSet = { species: value.species, moves: [...value.moves] as string[] };
  for (const field of stringFields) {
    if (value[field] !== undefined && typeof value[field] !== 'string') return;
    if (typeof value[field] === 'string') set[field] = value[field];
  }
  for (const field of numericFields) {
    if (value[field] !== undefined && (typeof value[field] !== 'number' || !Number.isFinite(value[field])))
      return;
    if (typeof value[field] === 'number') set[field] = value[field];
  }
  for (const field of ['shiny', 'gigantamax'] as const) {
    if (value[field] !== undefined && typeof value[field] !== 'boolean') return;
    if (typeof value[field] === 'boolean') set[field] = value[field];
  }
  for (const field of ['evs', 'ivs'] as const) {
    if (value[field] === undefined) continue;
    if (!isRecord(value[field])) return;
    const stats: StatTable = {};
    for (const stat of statOrder) {
      const num = value[field][stat];
      if (num !== undefined && (typeof num !== 'number' || !Number.isFinite(num))) return;
      if (typeof num === 'number') stats[stat] = num;
    }
    set[field] = stats;
  }
  return set;
}

function parseStoredTeam(value: unknown): StoredTeam | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.format !== 'string' ||
    !Array.isArray(value.sets)
  )
    return;
  const sets = value.sets.map(parseTeamSet);
  if (sets.some(set => !set)) return;
  return {
    id: value.id,
    name: value.name,
    format: value.format,
    folder: typeof value.folder === 'string' ? value.folder : '',
    sets: sets as TeamSet[],
    packed: packTeam(sets as TeamSet[]),
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : 0,
  };
}

export function parseLibrary(raw: string): { teams: StoredTeam[]; rejected: unknown[] } {
  const data: unknown = JSON.parse(raw);
  const records = Array.isArray(data)
    ? data
    : isRecord(data) && data.version === 2 && Array.isArray(data.teams)
      ? data.teams
      : null;
  if (!records) return { teams: [], rejected: [data] };
  const teams: StoredTeam[] = [];
  const rejected: unknown[] = [];
  const ids = new Set<string>();
  for (const record of records) {
    const team = parseStoredTeam(record);
    if (!team || ids.has(team.id)) rejected.push(record);
    else {
      teams.push(team);
      ids.add(team.id);
    }
  }
  return { teams, rejected };
}

export function hasStoredTeamLibrary() {
  try {
    return window.localStorage.getItem(TEAM_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

export function loadStoredTeams(): StoredTeam[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TEAM_STORAGE_KEY);
    librarySnapshot = raw;
    if (!raw) return [];
    const result = parseLibrary(raw);
    if (result.rejected.length) {
      storageProblem = `${result.rejected.length} damaged team record(s) were kept for recovery. Export recovery data before replacing them.`;
      try {
        window.localStorage.setItem(RECOVERY_KEY, raw);
      } catch {
        /* Original remains untouched. */
      }
    }
    return result.teams;
  } catch {
    storageProblem = 'Team storage could not be read. Export recovery data before replacing it.';
    if (librarySnapshot) {
      try {
        window.localStorage.setItem(RECOVERY_KEY, librarySnapshot);
      } catch {
        /* Original stays available until export. */
      }
    }
    return [];
  }
}

export const teamStorageProblem = () => storageProblem;
export function teamRecoveryData() {
  try {
    return window.localStorage.getItem(RECOVERY_KEY) || window.localStorage.getItem(TEAM_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/** Optimistic concurrency: a tab must reload a changed library before saving it. */
export function saveStoredTeams(teams: StoredTeam[]): StorageResult {
  if (typeof window === 'undefined') return { ok: false, error: 'Browser storage is unavailable.' };
  try {
    const current = window.localStorage.getItem(TEAM_STORAGE_KEY);
    if (librarySnapshot !== undefined && current !== librarySnapshot)
      return {
        ok: false,
        conflict: true,
        error: 'Teams changed in another tab. Reload the library, then save your preserved draft.',
      };
    const envelope: LibraryEnvelope = { version: 2, revision: createTeamId(), teams };
    const raw = JSON.stringify(envelope);
    window.localStorage.setItem(TEAM_STORAGE_KEY, raw);
    librarySnapshot = raw;
    storageProblem = '';
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        'Could not save to browser storage. Your edits remain open; export a backup or free storage and retry.',
    };
  }
}

export function loadTeamDraft(key: string, track = true): TeamDraft | undefined {
  try {
    const raw = window.localStorage.getItem(DRAFT_PREFIX + key);
    if (track) draftSnapshots.set(key, raw);
    if (!raw) return;
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.key !== key ||
      typeof value.name !== 'string' ||
      typeof value.format !== 'string' ||
      !Array.isArray(value.sets)
    )
      return;
    const sets = value.sets.map(parseTeamSet);
    if (sets.some(set => !set)) return;
    return {
      key,
      teamId: typeof value.teamId === 'string' ? value.teamId : undefined,
      baseUpdatedAt: typeof value.baseUpdatedAt === 'number' ? value.baseUpdatedAt : undefined,
      name: value.name,
      format: value.format,
      folder: typeof value.folder === 'string' ? value.folder : '',
      sets: sets as TeamSet[],
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
    };
  } catch {
    return;
  }
}

export function listTeamDrafts(): TeamDraft[] {
  try {
    return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      .filter((key): key is string => !!key?.startsWith(DRAFT_PREFIX))
      .map(key => loadTeamDraft(key.slice(DRAFT_PREFIX.length), false))
      .filter((draft): draft is TeamDraft => !!draft)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveTeamDraft(draft: TeamDraft): StorageResult {
  try {
    const key = DRAFT_PREFIX + draft.key;
    const current = window.localStorage.getItem(key);
    const previous = draftSnapshots.get(draft.key);
    if (previous !== undefined && current !== previous)
      return {
        ok: false,
        conflict: true,
        error: 'This draft changed in another tab. Export your edits or save a copy before reloading.',
      };
    const raw = JSON.stringify(draft);
    window.localStorage.setItem(key, raw);
    draftSnapshots.set(draft.key, raw);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Draft recovery could not be saved. Keep this page open and export your edits.',
    };
  }
}

export function removeTeamDraft(key: string) {
  try {
    window.localStorage.removeItem(DRAFT_PREFIX + key);
    draftSnapshots.delete(key);
  } catch {
    /* Library save already succeeded. */
  }
}

export function exportTeams(teams: StoredTeam[]): string {
  return teams
    .map(
      team =>
        `=== [${team.format}] ${team.folder ? `${team.folder}/` : ''}${team.name} ===\n\n${exportTeam(team.sets)}`,
    )
    .join('\n\n');
}

/** Readable backups, Arena JSON backups, and upstream's local packed `showdown_teams` storage. */
export function importTeamLibrary(text: string, format = 'gen9ou'): StoredTeam[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const { teams, rejected } = parseLibrary(trimmed);
    if (rejected.length)
      throw new Error('This backup contains invalid records. Keep the original and export recovery data.');
    return teams.map(team => ({ ...team, id: createTeamId(), updatedAt: Date.now() }));
  }
  if (
    !trimmed.startsWith('===') &&
    trimmed
      .split('\n')
      .every(line => line.includes(']') && line.slice(0, line.indexOf(']')).split('|').length === 2)
  ) {
    return trimmed.split('\n').map(line => {
      const separator = line.indexOf(']');
      const header = line.slice(0, separator);
      const bar = header.indexOf('|');
      const teamFormat = bar >= 0 ? header.slice(0, bar) : format;
      const fullName = bar >= 0 ? header.slice(bar + 1) : header;
      const slash = fullName.lastIndexOf('/');
      const sets = unpackTeam(line.slice(separator + 1));
      return {
        id: createTeamId(),
        name: slash >= 0 ? fullName.slice(slash + 1) : fullName,
        folder: slash >= 0 ? fullName.slice(0, slash) : '',
        format: teamFormat || format,
        sets,
        packed: packTeam(sets),
        updatedAt: Date.now(),
      };
    });
  }
  return importTeams(trimmed, format).map(team => ({ ...team, id: createTeamId() }));
}
