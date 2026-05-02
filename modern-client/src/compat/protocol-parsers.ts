import type { FormatOption } from '../stores/arena-store';
import type { PsLine } from './protocol-client';

export type RoomListEntry = {
  id: string;
  title: string;
  users?: number;
  p1?: string;
  p2?: string;
  format?: string;
  minElo?: number | string;
};

export type RoomList = {
  rooms: RoomListEntry[];
  userCount?: number;
  battleCount?: number;
};

export type SearchUpdate = {
  searching: string[];
  games: Record<string, string | { roomid?: string; p1?: string; p2?: string }>;
};

export const toId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export function parseFormats(args: string[]): FormatOption[] {
  const formats: FormatOption[] = [];
  let isSection = false;
  let section = '';

  for (let index = 0; index < args.length; index++) {
    const entry = args[index] || '';
    if (index === 0 && entry === '') continue;

    if (isSection) {
      section = entry;
      isSection = false;
      continue;
    }

    if (entry === ',LL') continue;
    if (entry === '' || (entry.startsWith(',') && !Number.isNaN(Number(entry.slice(1))))) {
      isSection = true;
      continue;
    }

    let name = entry;
    let searchShow = true;
    let challengeShow = true;
    let team = true;
    const lastCommaIndex = name.lastIndexOf(',');
    const code = lastCommaIndex >= 0 ? Number.parseInt(name.slice(lastCommaIndex + 1), 16) : Number.NaN;

    if (!Number.isNaN(code)) {
      name = name.slice(0, lastCommaIndex);
      team = !(code & 1);
      searchShow = !!(code & 2);
      challengeShow = !!(code & 4);
    } else if (name.endsWith(',#')) {
      team = false;
      name = name.slice(0, -2);
    } else if (name.endsWith(',,')) {
      challengeShow = false;
      name = name.slice(0, -2);
    } else if (name.endsWith(',')) {
      searchShow = false;
      name = name.slice(0, -1);
    }

    const id = toId(name);
    if (!id) continue;
    formats.push({ id, name, section, searchShow, team, challengeShow });
  }

  return formats;
}

export function parseQueryResponse(line: PsLine): { id: string; data: unknown } | null {
  const id = line.args[0];
  const raw = line.args.slice(1).join('|');
  if (!id || !raw) return null;
  try {
    return { id, data: JSON.parse(raw) as unknown };
  } catch {
    return null;
  }
}

export function parseRoomList(data: unknown): RoomList | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as {
    rooms?: Record<string, { title?: string; userCount?: number; users?: number; p1?: string; p2?: string; minElo?: number | string }>;
    userCount?: number;
    battleCount?: number;
  };
  if (!record.rooms || typeof record.rooms !== 'object') return null;

  return {
    userCount: record.userCount,
    battleCount: record.battleCount,
    rooms: Object.entries(record.rooms).map(([id, room]) => {
      const battleMatch = id.match(/^battle-([a-z0-9]+)-/);
      return {
        id,
        title: room.title || id,
        users: room.userCount ?? room.users,
        p1: room.p1,
        p2: room.p2,
        minElo: room.minElo,
        format: battleMatch?.[1],
      };
    }),
  };
}

export function parseSearchUpdate(raw: string): SearchUpdate | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SearchUpdate>;
    return {
      searching: Array.isArray(parsed.searching) ? parsed.searching : [],
      games: parsed.games && typeof parsed.games === 'object' ? parsed.games : {},
    };
  } catch {
    return null;
  }
}
