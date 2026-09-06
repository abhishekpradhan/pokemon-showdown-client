import type { ProtocolClient } from './protocol-client';
import { toId } from './protocol-parsers';
export type LadderRow = { rank: number; username: string; elo?: number; gxe?: number; glicko?: number; deviation?: number; coil?: number; record?: string };
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;

export function parseLadderData(data: unknown): LadderRow[] {
  if (!data || typeof data !== 'object' || !('toplist' in data) || !Array.isArray(data.toplist)) throw new Error('The server returned an unexpected ladder response.');
  return data.toplist.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && typeof row.username === 'string').slice(0, 5000).map((row, index) => ({ rank: number(row.rank) || index + 1, username: String(row.username), elo: number(row.elo), gxe: number(row.gxe), glicko: number(row.rpr ?? row.r), deviation: number(row.rprd ?? row.rd), coil: number(row.coil), record: row.w !== undefined || row.l !== undefined ? `${number(row.w) || 0}–${number(row.l) || 0}${row.t ? `–${number(row.t) || 0}` : ''}` : undefined }));
}

/** Extract plain table values; custom-server HTML is never inserted into the visible DOM. */
export function parseLocalLadderHtml(html: string): LadderRow[] {
  if (html.length > 2_000_000) throw new Error('Ladder response is too large. Narrow the player search.');
  const template = document.createElement('template'); template.innerHTML = html;
  const rows: LadderRow[] = [];
  for (const tr of template.content.querySelectorAll('tr')) {
    const cells = [...tr.querySelectorAll('td')].map(cell => cell.textContent?.trim() || '');
    if (cells.length < 3 || !/^\d+$/.test(cells[0])) continue;
    const rating = cells[4]?.match(/([\d.]+)\s*(?:±|\+\/-)\s*([\d.]+)/);
    rows.push({ rank: Number(cells[0]), username: cells[1], elo: number(cells[2]), gxe: number(cells[3]?.replace('%', '')), glicko: rating ? Number(rating[1]) : number(cells[4]), deviation: rating ? Number(rating[2]) : undefined, coil: number(cells[5]) });
  }
  return rows.slice(0, 5000);
}

function requestServerLadderNow(protocol: Pick<ProtocolClient, 'send' | 'subscribe'>, format: string, prefix: string, signal: AbortSignal): Promise<LadderRow[]> {
  return new Promise((resolve, reject) => {
    let done = false;
    let unsubscribe = () => {};
    const finish = (error?: Error, rows?: LadderRow[]) => { if (done) return; done = true; clearTimeout(timer); unsubscribe(); signal.removeEventListener('abort', abort); if (error) reject(error); else resolve(rows || []); };
    const abort = () => finish(new DOMException('Request cancelled.', 'AbortError'));
    const timer = window.setTimeout(() => finish(new Error('The server did not answer the ladder request. Retry when connected.')), 15_000);
    unsubscribe = protocol.subscribe(event => {
      if (event.type !== 'frame') return;
      for (const line of event.frame.lines) {
        if (line.command !== 'queryresponse' || line.args[0] !== 'laddertop') continue;
        try {
          const response: unknown = JSON.parse(line.args.slice(1).join('|'));
          if (!Array.isArray(response) || response[0] !== format) continue;
          if (typeof response[1] === 'string') finish(undefined, parseLocalLadderHtml(response[1]));
          else if (response[1]) finish(undefined, parseLadderData(response[1]));
          else finish(new Error('This server has no ladder data for that format.'));
        } catch (error) { finish(error instanceof Error ? error : new Error('Invalid ladder response.')); }
      }
    });
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    if (protocol.send(`/cmd laddertop ${toId(format)}${prefix ? ` ,${toId(prefix)}` : ''}`) === false) finish(new Error('The connection closed before the ladder request could be sent.')); 
  });
}

// The wire response identifies the format but not the prefix. Serialize requests
// so an earlier prefix response cannot be mistaken for a later search after cancellation.
const serverRequests = new WeakMap<object, Promise<unknown>>();
export function requestServerLadder(protocol: Pick<ProtocolClient, 'send' | 'subscribe'>, format: string, prefix: string, signal: AbortSignal): Promise<LadderRow[]> {
  const previous = serverRequests.get(protocol) || Promise.resolve();
  const work = previous.catch(() => {}).then(() => {
    if (signal.aborted) throw new DOMException('Request cancelled.', 'AbortError');
    return requestServerLadderNow(protocol, format, prefix, new AbortController().signal);
  });
  serverRequests.set(protocol, work);
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Request cancelled.', 'AbortError'));
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    void work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function requestPublicLadder(host: string, format: string, user: string, exact: boolean, signal: AbortSignal): Promise<LadderRow[]> {
  const url = new URL(exact && user ? `/users/${toId(user)}.json` : `/ladder/${toId(format)}.json`, host);
  if (user && !exact) url.searchParams.set('prefix', toId(user));
  const response = await fetch(url, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error(`Rankings unavailable (HTTP ${response.status}).`);
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('Ladder response is too large. Narrow your search.');
  const data: unknown = JSON.parse(text);
  if (exact && user) {
    if (!data || typeof data !== 'object' || !('ratings' in data) || !data.ratings || typeof data.ratings !== 'object') throw new Error('No player ratings returned.');
    const rating = (data.ratings as Record<string, unknown>)[format];
    if (!rating || typeof rating !== 'object') return [];
    return parseLadderData({ toplist: [{ ...rating, username: 'username' in data ? data.username : user }] }).map(row => ({ ...row, rank: 0 }));
  }
  return parseLadderData(data);
}
