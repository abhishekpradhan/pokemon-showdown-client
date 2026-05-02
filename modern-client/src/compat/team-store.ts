import type { PokemonSet } from './battle-adapter';
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
};

export type StoredTeam = {
  id: string;
  name: string;
  format: string;
  packed: string;
  sets: TeamSet[];
  updatedAt: number;
};

export type TeamSummary = {
  id: string;
  name: string;
  format: string;
  pokemon: PokemonSet[];
  packed: string;
};

export type PackedTeam = string;

const STORAGE_KEY = 'ps-modern-teams-v1';

const statOrder = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

const displayName = (value: string) => value
  .replace(/[-_]/g, ' ')
  .replace(/\b\w/g, letter => letter.toUpperCase());

const parseStats = (value: string): StatTable | undefined => {
  if (!value) return undefined;
  const stats: StatTable = {};
  for (const part of value.split('/')) {
    const match = part.trim().match(/^(\d+)\s+([A-Za-z]+)/);
    if (!match) continue;
    const key = match[2].toLowerCase() === 'spatk' ? 'spa' :
      match[2].toLowerCase() === 'spdef' ? 'spd' :
      match[2].toLowerCase() as keyof StatTable;
    if (statOrder.includes(key as typeof statOrder[number])) stats[key] = Number(match[1]);
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
  return team.map(set => {
    const speciesId = toId(set.species);
    const name = set.name || set.species;
    const parts = [
      name,
      toId(name) === speciesId ? '' : speciesId,
      toId(set.item || ''),
      toId(set.ability || ''),
      set.moves.map(toId).filter(Boolean).join(','),
      set.nature || '',
      statsToPacked(set.evs),
      set.gender || '',
      statsToPacked(set.ivs, 31),
      set.shiny ? 'S' : '',
      set.level && set.level !== 100 ? String(set.level) : '',
    ];
    const misc = [
      set.happiness !== undefined && set.happiness !== 255 ? String(set.happiness) : '',
      '',
      '',
      '',
      '',
      set.teraType || '',
    ];
    return `${parts.join('|')}|${misc.some(Boolean) ? misc.join(',') : ''}`;
  }).join(']');
}

export function unpackTeam(packed: PackedTeam): TeamSet[] {
  if (!packed.trim()) return [];
  return packed.trim().split(']').filter(Boolean).map(chunk => {
    const parts = chunk.split('|');
    const species = displayName(parts[1] || parts[0] || 'Pokemon');
    const evValues = (parts[6] || '').split(',');
    const ivValues = (parts[8] || '').split(',');
    const misc = (parts[11] || '').split(',');
    const evs = evValues.length > 1 ? Object.fromEntries(statOrder.map((stat, index) => [stat, Number(evValues[index]) || 0])) as StatTable : undefined;
    const ivs = ivValues.length > 1 ? Object.fromEntries(statOrder.map((stat, index) => [stat, ivValues[index] === '' ? 31 : Number(ivValues[index])])) as StatTable : undefined;

    return {
      name: parts[0] || species,
      species,
      item: parts[2] ? displayName(parts[2]) : undefined,
      ability: parts[3] ? displayName(parts[3]) : undefined,
      moves: (parts[4] || '').split(',').filter(Boolean).map(displayName),
      nature: parts[5] || undefined,
      evs,
      gender: parts[7] || undefined,
      ivs,
      shiny: parts[9] === 'S',
      level: parts[10] ? Number(parts[10]) : undefined,
      happiness: misc[0] ? Number(misc[0]) : undefined,
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
      const nameLine = atIndex >= 0 ? line.slice(0, atIndex) : line;
      const item = atIndex >= 0 ? line.slice(atIndex + 3) : undefined;
      const speciesMatch = nameLine.match(/^(.*?)\s+\((.*?)\)$/);
      current = {
        name: speciesMatch ? speciesMatch[1] : nameLine,
        species: speciesMatch ? speciesMatch[2] : nameLine,
        item,
        moves: [],
      };
      sets.push(current);
      continue;
    }

    if (line.startsWith('Ability: ')) current.ability = line.slice(9);
    else if (line.startsWith('Level: ')) current.level = Number(line.slice(7)) || undefined;
    else if (line.startsWith('Tera Type: ')) current.teraType = line.slice(11);
    else if (line === 'Shiny: Yes') current.shiny = true;
    else if (line.startsWith('EVs: ')) current.evs = parseStats(line.slice(5));
    else if (line.startsWith('IVs: ')) current.ivs = parseStats(line.slice(5));
    else if (line.endsWith(' Nature')) current.nature = line.slice(0, -7);
    else if (line.startsWith('- ')) current.moves.push(line.slice(2));
  }

  return sets;
}

export function exportTeam(team: TeamSet[] | PackedTeam): string {
  const sets = typeof team === 'string' ? unpackTeam(team) : team;
  return sets.map(set => {
    const title = `${set.name && set.name !== set.species ? `${set.name} (${set.species})` : set.species}${set.item ? ` @ ${set.item}` : ''}`;
    const lines = [
      title,
      set.ability ? `Ability: ${set.ability}` : '',
      set.level ? `Level: ${set.level}` : '',
      set.shiny ? 'Shiny: Yes' : '',
      set.teraType ? `Tera Type: ${set.teraType}` : '',
      set.evs ? `EVs: ${statOrder.map(stat => `${set.evs?.[stat] || 0} ${stat.toUpperCase()}`).join(' / ')}` : '',
      set.nature ? `${set.nature} Nature` : '',
      set.ivs ? `IVs: ${statOrder.map(stat => `${set.ivs?.[stat] ?? 31} ${stat.toUpperCase()}`).join(' / ')}` : '',
      ...set.moves.map(move => `- ${move}`),
    ].filter(Boolean);
    return lines.join('\n');
  }).join('\n\n');
}

export function importTeams(text: string, format = 'gen9ou'): StoredTeam[] {
  const normalized = text.trim().replace(/\r\n/g, '\n');
  if (!normalized) return [];
  if (!normalized.startsWith('===')) {
    const sets = importTeam(normalized);
    const name = sets[0]?.species ? `${sets[0].species} team` : 'Imported team';
    return [{ id: `${toId(name)}-${Date.now()}`, name, format, sets, packed: packTeam(sets), updatedAt: Date.now() }];
  }

  const teams: StoredTeam[] = [];
  const blocks = normalized.split(/\n(?====)/g);
  for (const block of blocks) {
    const [header = '', ...body] = block.split('\n');
    const title = header.replace(/^===\s*/, '').replace(/\s*===$/, '').trim();
    const bracket = title.match(/^\[(.*?)\]\s*(.*)$/);
    const teamFormat = bracket?.[1] ? toId(bracket[1]) : format;
    const name = bracket?.[2] || title || 'Imported team';
    const sets = importTeam(body.join('\n'));
    teams.push({ id: `${toId(name)}-${Date.now()}-${teams.length}`, name, format: teamFormat, sets, packed: packTeam(sets), updatedAt: Date.now() });
  }
  return teams;
}

export function teamSummary(team: StoredTeam): TeamSummary {
  return {
    id: team.id,
    name: team.name,
    format: team.format,
    packed: team.packed,
    pokemon: team.sets.map((set, index): PokemonSet => ({
      slot: index + 1,
      name: set.name || set.species,
      species: toId(set.species),
      hp: 100,
      active: index === 0,
    })),
  };
}

export function loadStoredTeams(): StoredTeam[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as StoredTeam[] : [];
  } catch {
    return [];
  }
}

export function saveStoredTeams(teams: StoredTeam[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
}

export function importPackedTeam(text: string): PackedTeam {
  return packTeam(importTeam(text));
}

export function exportPackedTeam(team: PackedTeam): string {
  return packTeam(team);
}
