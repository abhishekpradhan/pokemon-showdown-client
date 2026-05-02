import { parsePsFrame, parsePsLine, ProtocolClient, serverWebSocketUrl, type ServerConfig } from './protocol-client';

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
