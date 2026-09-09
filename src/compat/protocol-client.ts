import { recordClientError } from './diagnostics';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error';

export type ServerConfig = {
  id: string;
  host: string;
  port: number;
  prefix: string;
  secure: boolean;
  loginServer: string;
};

export type PsLine = {
  raw: string;
  command: string;
  args: string[];
};

export type PsFrame = {
  roomId: string;
  raw: string;
  lines: PsLine[];
};

export type ConnectionEvent =
  | { type: 'state'; state: ConnectionState; reason?: string }
  | { type: 'frame'; frame: PsFrame }
  | { type: 'send'; message: string }
  | { type: 'error'; error: Error };

export type ProtocolMessageHandler = (event: ConnectionEvent) => void;

type WebSocketCtor = typeof WebSocket;

const DEFAULT_SERVER: ServerConfig = {
  id: import.meta.env.VITE_PS_SERVER_ID || 'showdown',
  host: import.meta.env.VITE_PS_SERVER_HOST || 'sim3.psim.us',
  port: Number(import.meta.env.VITE_PS_SERVER_PORT || 443),
  prefix: import.meta.env.VITE_PS_SERVER_PREFIX || '/showdown',
  secure: (import.meta.env.VITE_PS_SERVER_SECURE || 'true') !== 'false',
  loginServer: import.meta.env.VITE_PS_LOGIN_SERVER || 'https://play.pokemonshowdown.com/action.php',
};

const SERVER_STORAGE_KEY = 'arena.server';

/** What a failing subscriber was handling, for the diagnostics record (sanitized there). */
const describeEvent = (event: ConnectionEvent): string => {
  switch (event.type) {
    case 'frame':
      return event.frame.raw;
    case 'send':
      return event.message;
    case 'state':
      return `state:${event.state}`;
    case 'error':
      return `error:${event.error.message}`;
  }
};

export function getDefaultServerConfig(): ServerConfig {
  return { ...DEFAULT_SERVER };
}

/**
 * A saved server survives reloads so people running their own PS-compatible
 * server do not have to re-enter it every session. Build-time env vars supply
 * the default; this overrides it at runtime.
 */
export function loadStoredServer(): ServerConfig {
  try {
    const raw = localStorage.getItem(SERVER_STORAGE_KEY);
    if (!raw) return getDefaultServerConfig();
    const parsed = JSON.parse(raw) as Partial<ServerConfig>;
    if (!parsed || typeof parsed.host !== 'string' || !/^[a-z0-9.:[\]-]+$/i.test(parsed.host))
      return getDefaultServerConfig();
    if (
      typeof parsed.port !== 'number' ||
      !Number.isInteger(parsed.port) ||
      parsed.port < 1 ||
      parsed.port > 65535
    )
      return getDefaultServerConfig();
    if (
      typeof parsed.secure !== 'boolean' ||
      typeof parsed.prefix !== 'string' ||
      !/^\/[a-z0-9/_-]*$/i.test(parsed.prefix)
    )
      return getDefaultServerConfig();
    return { ...getDefaultServerConfig(), ...parsed };
  } catch {
    return getDefaultServerConfig();
  }
}

export function saveStoredServer(server: ServerConfig | null) {
  try {
    if (server) localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(server));
    else localStorage.removeItem(SERVER_STORAGE_KEY);
  } catch {
    // Private browsing or a full quota; the session still works, it just will
    // not be remembered.
  }
}

/** Normalizes user input like "localhost:8000" or "wss://my.server/showdown". */
export function parseServerInput(input: string, base = getDefaultServerConfig()): ServerConfig | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `wss://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (
    !url.hostname ||
    !['ws:', 'wss:', 'http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    return null;

  const secure = url.protocol === 'wss:' || url.protocol === 'https:';
  const path = url.pathname.replace(/\/websocket\/?$/, '').replace(/\/$/, '');
  return {
    ...base,
    host: url.hostname,
    port: url.port ? Number(url.port) : secure ? 443 : 8000,
    prefix: path || '/showdown',
    secure,
    id: url.hostname === 'sim3.psim.us' ? 'showdown' : url.hostname.split('.')[0] || base.id,
  };
}

export function serverWebSocketUrl(server: ServerConfig) {
  const protocol = server.secure ? 'wss' : 'ws';
  const prefix = server.prefix.startsWith('/') ? server.prefix : `/${server.prefix}`;
  return `${protocol}://${server.host}:${server.port}${prefix}/websocket`;
}

export function parsePsLine(raw: string): PsLine {
  if (!raw.startsWith('|')) return { raw, command: 'format', args: [raw] };
  const parts = raw.split('|');
  return {
    raw,
    command: parts[1] || '',
    args: parts.slice(2),
  };
}

export function parsePsFrame(rawFrame: string): PsFrame {
  const raw = rawFrame.endsWith('\n') ? rawFrame.slice(0, -1) : rawFrame;
  let roomId = '';
  let body = raw;

  if (raw.startsWith('>')) {
    const newlineIndex = raw.indexOf('\n');
    if (newlineIndex >= 0) {
      roomId = raw.slice(1, newlineIndex);
      body = raw.slice(newlineIndex + 1);
    } else {
      roomId = raw.slice(1);
      body = '';
    }
  }

  return {
    roomId,
    raw,
    lines: body ? body.split('\n').map(parsePsLine) : [],
  };
}

export class ProtocolClient {
  private socket: WebSocket | null = null;
  private queue: string[] = [];
  private handlers = new Set<ProtocolMessageHandler>();
  private reconnectTimer: number | null = null;
  private reconnectDelay = 1_000;
  private readonly reconnectCap = 15_000;
  private manualClose = false;
  private generation = 0;
  state: ConnectionState = 'offline';

  constructor(
    private server: ServerConfig = getDefaultServerConfig(),
    private WebSocketImpl: WebSocketCtor | undefined = globalThis.WebSocket,
  ) {}

  connect() {
    if (this.socket) return;
    this.manualClose = false;
    this.setState(this.state === 'offline' ? 'connecting' : 'reconnecting');

    try {
      if (!this.WebSocketImpl) throw new Error('WebSocket is not available in this environment');
      const socket = new this.WebSocketImpl(serverWebSocketUrl(this.server));
      this.socket = socket;
      const generation = ++this.generation;
      const current = () => this.socket === socket && generation === this.generation;

      socket.onopen = () => {
        if (!current()) return;
        this.reconnectDelay = 1_000;
        this.setState('connected');
        const queued = [...this.queue];
        this.queue = [];
        queued.forEach(message => {
          socket.send(message);
          this.emit({ type: 'send', message });
        });
      };

      socket.onmessage = event => {
        if (!current()) return;
        this.emit({ type: 'frame', frame: parsePsFrame(String(event.data)) });
      };

      socket.onerror = () => {
        if (!current()) return;
        this.setState('error', 'WebSocket error');
        this.emit({ type: 'error', error: new Error('WebSocket error') });
      };

      socket.onclose = () => {
        if (!current()) return;
        this.socket = null;
        if (this.manualClose) {
          this.setState('offline');
          return;
        }
        this.scheduleReconnect();
      };
    } catch (error) {
      this.emit({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.manualClose = true;
    ++this.generation;
    this.queue = [];
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
    }
    this.setState('offline');
  }

  reconnect() {
    this.disconnect();
    this.manualClose = false;
    this.connect();
  }

  send(message: string, roomId = '') {
    if (/[\r\n|]/.test(roomId) || /[\r\n]/.test(message)) {
      this.emit({ type: 'error', error: new Error('Commands must contain a single line.') });
      return false;
    }
    const payload = `${roomId}|${message}`;
    if (this.state !== 'connected' || !this.socket) {
      // Only replaceable, public read queries survive a temporary disconnect.
      // Chat, identity, teams and choices require a current authenticated session.
      if (!roomId && /^\/cmd (?:rooms|roomlist|userdetails)(?: |$)/.test(message)) {
        if (!this.queue.includes(payload)) this.queue = [...this.queue, payload].slice(-20);
      } else {
        this.emit({
          type: 'error',
          error: new Error('Not sent: reconnect before sending messages or battle commands.'),
        });
      }
      return false;
    }
    try {
      this.socket.send(payload);
      this.emit({ type: 'send', message: payload });
      return true;
    } catch {
      this.emit({
        type: 'error',
        error: new Error('The connection closed before the command could be sent. Reconnect and try again.'),
      });
      return false;
    }
  }

  subscribe(handler: ProtocolMessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  queuedCount() {
    return this.queue.length;
  }

  getServer() {
    return this.server;
  }

  setServer(server: ServerConfig) {
    this.server = server;
    this.reconnect();
  }

  private scheduleReconnect() {
    this.setState('reconnecting');
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.reconnectCap);
      this.connect();
    }, this.reconnectDelay);
  }

  private setState(state: ConnectionState, reason?: string) {
    this.state = state;
    this.emit({ type: 'state', state, reason });
  }

  private emit(event: ConnectionEvent) {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        // Subscribers are independent (the store, a ladder request, a test
        // probe): one throwing must not starve the rest of the same event.
        recordClientError('protocol-client', error, describeEvent(event));
      }
    }
  }
}
