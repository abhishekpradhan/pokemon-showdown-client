export const REPLAY_HOST = import.meta.env.VITE_PS_REPLAY_HOST || 'https://replay.pokemonshowdown.com';
export const MAX_REPLAY_BYTES = 5 * 1024 * 1024;
export const MAX_REPLAY_LINES = 50_000;
export const MAX_REPLAY_TURNS = 2_000;
export type ReplayMetadata = {
  id: string;
  url?: string;
  format?: string;
  players: string[];
  uploadtime?: number;
  private?: number;
  rating?: number;
};
export type LoadedReplay = ReplayMetadata & { log: string; lines: string[] };
export type ReplaySearchResult = ReplayMetadata & { password?: string };

function readMetadata(value: unknown): ReplayMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.id !== 'string' ||
    !Array.isArray(entry.players) ||
    !entry.players.every(player => typeof player === 'string')
  )
    return null;
  return {
    id: entry.id,
    players: entry.players.slice(0, 4),
    format: typeof entry.format === 'string' ? entry.format : undefined,
    uploadtime: typeof entry.uploadtime === 'number' ? entry.uploadtime : undefined,
    private: typeof entry.private === 'number' ? entry.private : undefined,
    rating: typeof entry.rating === 'number' ? entry.rating : undefined,
  };
}

/** Parse the URL path independently of query/viewpoint/hash data; never truncate private identifiers. */
export function normalizeReplayUrl(input: string, host = REPLAY_HOST) {
  const value = input.trim();
  const url = new URL(
    /^https?:\/\//i.test(value) ? value : `${host.replace(/\/$/, '')}/${value.replace(/^\/+/, '')}`,
  );
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Use an HTTP(S) replay URL without embedded credentials.');
  url.pathname = url.pathname.replace(/\/$/, '').replace(/\.(?:json|log)$/i, '');
  if (!url.pathname || url.pathname === '/') throw new Error('The replay URL needs a replay ID.');
  const side: 'p1' | 'p2' = url.searchParams.has('p2') || url.hash === '#p2' ? 'p2' : 'p1';
  const turnValue =
    url.searchParams.get('turn') ?? url.searchParams.get('t') ?? url.hash.match(/^#turn(\d+)$/)?.[1];
  const turn =
    turnValue != null && Number.isFinite(Number(turnValue))
      ? Math.max(0, Math.floor(Number(turnValue)))
      : undefined;
  url.hash = '';
  const canonical = url.toString();
  const dataUrl = new URL(canonical);
  dataUrl.pathname += '.json';
  return {
    url: canonical,
    dataUrl: dataUrl.toString(),
    id: decodeURIComponent(url.pathname.slice(1)),
    side,
    turn,
  };
}

export function parseReplayLog(log: string, metadata: Partial<ReplayMetadata> = {}): LoadedReplay {
  if (new Blob([log]).size > MAX_REPLAY_BYTES)
    throw new Error('Replay is larger than 5 MB. Download or trim the log before opening it.');
  const lines = log.split(/\r?\n/).filter(Boolean);
  if (lines.length > MAX_REPLAY_LINES) throw new Error('Replay exceeds the 50,000-line playback limit.');
  if (lines.filter(line => line.startsWith('|turn|')).length > MAX_REPLAY_TURNS)
    throw new Error('Replay exceeds the 2,000-turn playback limit.');
  if (!lines.some(line => /^\|(?:start|turn|switch|move|poke)\|?/.test(line)))
    throw new Error('No battle protocol found. Paste a replay URL or a Showdown battle log.');
  const players = ['p1', 'p2'].map(
    side => lines.find(line => line.startsWith(`|player|${side}|`))?.split('|')[3] || side,
  );
  return {
    id: metadata.id || 'local',
    format: lines.find(line => line.startsWith('|tier|'))?.split('|')[2],
    players,
    ...Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)),
    log,
    lines,
  };
}

async function boundedText(response: Response): Promise<string> {
  if (!response.ok) throw new Error(`Replay request failed (HTTP ${response.status}).`);
  if (Number(response.headers.get('content-length')) > MAX_REPLAY_BYTES)
    throw new Error('Replay is larger than 5 MB.');
  if (!response.body?.getReader) {
    const text = await response.text();
    if (new Blob([text]).size > MAX_REPLAY_BYTES) throw new Error('Replay is larger than 5 MB.');
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_REPLAY_BYTES) {
        await reader.cancel();
        throw new Error('Replay is larger than 5 MB.');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function fetchReplay(input: string, signal: AbortSignal): Promise<LoadedReplay> {
  const normalized = normalizeReplayUrl(input);
  let response = await fetch(normalized.dataUrl, { signal, credentials: 'omit' });
  // Older replay hosts may expose only raw .log files. Preserve the path token and query on fallback.
  if (response.status === 404) {
    const rawUrl = new URL(normalized.dataUrl);
    rawUrl.pathname = rawUrl.pathname.replace(/\.json$/, '.log');
    response = await fetch(rawUrl, { signal, credentials: 'omit' });
  }
  const text = await boundedText(response);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return parseReplayLog(text, normalized);
  }
  if (!data || typeof data !== 'object' || !('log' in data) || typeof data.log !== 'string')
    throw new Error('The server did not return a replay log. The replay may be private or removed.');
  const record = data as Record<string, unknown>;
  return parseReplayLog(data.log, {
    id: normalized.id,
    url: normalized.url,
    format: typeof record.format === 'string' ? record.format : undefined,
    players:
      Array.isArray(record.players) && record.players.every(value => typeof value === 'string')
        ? (record.players as string[])
        : undefined,
    private: typeof record.private === 'number' ? record.private : undefined,
    uploadtime: typeof record.uploadtime === 'number' ? record.uploadtime : undefined,
    rating: typeof record.rating === 'number' ? record.rating : undefined,
  });
}

export async function searchReplays(
  user: string,
  format: string,
  page: number,
  signal: AbortSignal,
): Promise<ReplaySearchResult[]> {
  const url = new URL(`/api/replays/${user.trim() || format.trim() ? 'search' : 'recent'}`, REPLAY_HOST);
  if (user.trim()) url.searchParams.set('username', user.trim());
  if (format.trim()) url.searchParams.set('format', format.trim());
  url.searchParams.set('page', String(page));
  const response = await fetch(url, { signal, credentials: 'omit' });
  const parsed: unknown = JSON.parse((await boundedText(response)).replace(/^\]/, ''));
  if (!Array.isArray(parsed)) throw new Error('Replay search returned an unexpected response.');
  return parsed
    .flatMap((entry): ReplaySearchResult[] => {
      const metadata = readMetadata(entry);
      return metadata && /^[a-z0-9-]+$/i.test(metadata.id)
        ? [
            {
              ...metadata,
              password:
                typeof entry.password === 'string' && /^[a-z0-9]+$/i.test(entry.password)
                  ? entry.password
                  : undefined,
            },
          ]
        : [];
    })
    .slice(0, 51);
}

const COLLECTION_KEY = 'ps-arena-replays-v1';
export type ReplayCollection = Array<ReplayMetadata & { bookmarked?: boolean; viewedAt: number }>;
export function loadReplayCollection(): ReplayCollection {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(COLLECTION_KEY) || '[]');
    return Array.isArray(data)
      ? data
          .flatMap((entry): ReplayCollection => {
            const metadata = readMetadata(entry);
            if (!metadata || typeof entry.url !== 'string' || !/^https?:\/\//i.test(entry.url)) return [];
            try {
              return [
                {
                  ...metadata,
                  url: normalizeReplayUrl(entry.url).url,
                  bookmarked: entry.bookmarked === true,
                  viewedAt: typeof entry.viewedAt === 'number' ? entry.viewedAt : 0,
                },
              ];
            } catch {
              return [];
            }
          })
          .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
export function saveReplayCollection(collection: ReplayCollection): boolean {
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection.slice(0, 100)));
    return true;
  } catch {
    return false;
  }
}
