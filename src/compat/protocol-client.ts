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
    if (!parsed.host) return getDefaultServerConfig();
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
  if (!url.hostname) return null;

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
  state: ConnectionState = 'offline';

  constructor(
    private server: ServerConfig = getDefaultServerConfig(),
    private WebSocketImpl: WebSocketCtor | undefined = globalThis.WebSocket
  ) {}

  connect() {
    if (this.socket && (this.state === 'connected' || this.state === 'connecting')) return;
    this.manualClose = false;
    this.setState(this.state === 'offline' ? 'connecting' : 'reconnecting');

    try {
      if (!this.WebSocketImpl) throw new Error('WebSocket is not available in this environment');
      const socket = new this.WebSocketImpl(serverWebSocketUrl(this.server));
      this.socket = socket;

      socket.onopen = () => {
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
        this.emit({ type: 'frame', frame: parsePsFrame(String(event.data)) });
      };

      socket.onerror = () => {
        this.setState('error', 'WebSocket error');
        this.emit({ type: 'error', error: new Error('WebSocket error') });
      };

      socket.onclose = () => {
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
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.setState('offline');
  }

  reconnect() {
    this.disconnect();
    this.manualClose = false;
    this.connect();
  }

  send(message: string, roomId = '') {
    const payload = `${roomId}|${message}`;
    if (this.state !== 'connected' || !this.socket) {
      this.queue.push(payload);
      return;
    }
    this.socket.send(payload);
    this.emit({ type: 'send', message: payload });
  }

  subscribe(handler: ProtocolMessageHandler) {
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
    this.handlers.forEach(handler => handler(event));
  }
}
