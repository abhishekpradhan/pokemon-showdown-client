import { ProtocolClient, parsePsFrame, parsePsLine, parseServerInput, serverWebSocketUrl, type ServerConfig } from './protocol-client';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(message: string) {
    this.sent.push(message);
  }

  close() {
    this.onclose?.();
  }
}

const server: ServerConfig = {
  id: 'test',
  host: 'localhost',
  port: 8000,
  prefix: '/showdown',
  secure: false,
  loginServer: 'http://localhost/action.php',
};

describe('PS protocol helpers', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
  });

  it('builds websocket URLs from server config', () => {
    expect(serverWebSocketUrl(server)).toBe('ws://localhost:8000/showdown/websocket');
  });

  it('parses room frames and protocol lines', () => {
    const frame = parsePsFrame('>battle-gen9ou-1\n|init|battle\n|title|Alice vs. Bob\n|request|{"rqid":3}');

    expect(frame.roomId).toBe('battle-gen9ou-1');
    expect(frame.lines[0]).toEqual(parsePsLine('|init|battle'));
    expect(frame.lines[2].command).toBe('request');
    expect(frame.lines[2].args[0]).toBe('{"rqid":3}');
  });

  it('queues messages while offline and flushes on connect', () => {
    const client = new ProtocolClient(server, FakeWebSocket as unknown as typeof WebSocket);
    const states: string[] = [];
    client.subscribe(event => {
      if (event.type === 'state') states.push(event.state);
    });

    client.send('/search gen9ou');
    expect(client.queuedCount()).toBe(1);

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.onopen?.();

    expect(states).toContain('connected');
    expect(socket.sent).toEqual(['|/search gen9ou']);
    expect(client.queuedCount()).toBe(0);
  });

  it('emits parsed frames from websocket messages', () => {
    const client = new ProtocolClient(server, FakeWebSocket as unknown as typeof WebSocket);
    const roomIds: string[] = [];
    client.subscribe(event => {
      if (event.type === 'frame') roomIds.push(event.frame.roomId);
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.onopen?.();
    socket.onmessage?.({ data: '>lobby\n|c|alice|hello' });

    expect(roomIds).toEqual(['lobby']);
  });
});

describe('server address parsing', () => {
  it('accepts a bare host:port the way a self-hoster would type it', () => {
    const parsed = parseServerInput('localhost:8000');
    expect(parsed).toMatchObject({ host: 'localhost', port: 8000, prefix: '/showdown', secure: true });
  });

  it('honours an explicit scheme', () => {
    expect(parseServerInput('ws://localhost:8000')).toMatchObject({ secure: false, port: 8000 });
    expect(parseServerInput('wss://sim3.psim.us/showdown')).toMatchObject({ secure: true, port: 443 });
  });

  it('strips a pasted /websocket suffix', () => {
    // People copy the URL out of devtools, which includes the endpoint.
    expect(parseServerInput('wss://my.server:443/showdown/websocket')).toMatchObject({
      host: 'my.server',
      prefix: '/showdown',
    });
  });

  it('defaults the port by scheme', () => {
    expect(parseServerInput('ws://my.server')?.port).toBe(8000);
    expect(parseServerInput('wss://my.server')?.port).toBe(443);
  });

  it('rejects junk rather than producing an unusable config', () => {
    expect(parseServerInput('')).toBeNull();
    expect(parseServerInput('   ')).toBeNull();
    expect(parseServerInput('://')).toBeNull();
  });

  it('builds the websocket url from the parsed config', () => {
    const parsed = parseServerInput('localhost:8000')!;
    expect(serverWebSocketUrl({ ...parsed, secure: false })).toBe('ws://localhost:8000/showdown/websocket');
  });
});
