import type { Page } from '@playwright/test';

export async function installMockPs(page: Page) {
  await page.addInitScript(() => {
    type Listener = (event: MessageEvent | Event) => void;

    const sent: string[] = JSON.parse(localStorage.getItem('__mockPsSent') || '[]') as string[];
    const sockets: MockPsWebSocket[] = [];
    const battleRequest = JSON.stringify({
      rqid: 7,
      side: {
        name: 'CodexTester',
        pokemon: [
          { ident: 'p1: Iron Valiant', details: 'Iron Valiant, L80', condition: '156/200', active: true },
          { ident: 'p1: Heatran', details: 'Heatran, L80', condition: '184/200' },
          { ident: 'p1: Dragapult', details: 'Dragapult, L80', condition: '0 fnt' },
        ],
      },
      active: [{
        moves: [
          { move: 'Moonblast', id: 'moonblast', type: 'Fairy', pp: 11, maxpp: 16, target: 'normal' },
          { move: 'Close Combat', id: 'closecombat', type: 'Fighting', pp: 7, maxpp: 8, disabled: true },
        ],
        canTerastallize: 'Fairy',
      }],
      targetable: true,
    });

    class MockPsWebSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readonly CONNECTING = 0;
      readonly OPEN = 1;
      readonly CLOSING = 2;
      readonly CLOSED = 3;
      readyState = MockPsWebSocket.CONNECTING;
      url: string;
      onopen: Listener | null = null;
      onmessage: Listener | null = null;
      onclose: Listener | null = null;
      onerror: Listener | null = null;

      constructor(url: string) {
        super();
        this.url = url;
        sockets.push(this);
        setTimeout(() => {
          this.readyState = MockPsWebSocket.OPEN;
          this.onopen?.(new Event('open'));
          this.dispatchEvent(new Event('open'));
          this.emit('|challstr|1|mock-challenge');
          this.emit('|formats|,1|S/V Singles|[Gen 9] Random Battle,4f|[Gen 9] OU,e');
          this.emit('|updateuser|Guest 1000|0|0');
          this.emit('>lobby\n|init|chat\n|title|Lobby\n|users|, Guest 1000,+Driver\n|c|Driver|Welcome to the mock lobby.');
          if (localStorage.getItem('__mockBattleStarted') === '1') this.emitBattle();
        }, 0);
      }

      send(message: string) {
        sent.push(message);
        localStorage.setItem('__mockPsSent', JSON.stringify(sent));
        if (message.includes('/trn ')) {
          const payload = message.split('/trn ')[1] ?? '';
          const [name, , assertion] = payload.split(',');
          const trimmed = name?.trim() || '';

          // A real server rejects `/trn <name>` with no assertion. The mock
          // used to accept it, which is precisely how a client that never
          // called the login server shipped with a green test suite.
          if (!assertion) {
            setTimeout(() => this.emit('|nametaken||Your authentication token was invalid.'), 200);
            return;
          }
          if (trimmed === 'TakenName') {
            setTimeout(() => this.emit('|nametaken|TakenName|That name is already registered.'), 250);
          } else {
            // Named users arrive with a group symbol prefix; a regular user's
            // is a space.
            setTimeout(() => this.emit(`|updateuser| ${trimmed}|1|0`), 350);
          }
        }
        if (message.includes('/cmd roomlist')) {
          this.emit(`|queryresponse|roomlist|${JSON.stringify({
            rooms: {
              lobby: { title: 'Lobby', userCount: 2 },
              'battle-gen9ou-1': { p1: 'CodexTester', p2: 'MockRival', minElo: 1000 },
            },
            userCount: 2,
            battleCount: 1,
          })}`);
        }
        if (message.includes('/cancelsearch')) {
          this.emit('|updatesearch|{"searching":[],"games":{}}');
        }
        if (message.includes('/join battle-gen9uu-spectate1')) {
          // A battle between two other players: the joiner is a spectator.
          // No |request| ever arrives for spectators.
          this.emit('>battle-gen9uu-spectate1\n|init|battle\n|title|AlphaPlayer vs. BetaPlayer\n|player|p1|AlphaPlayer|60|1400\n|player|p2|BetaPlayer|61|1380\n|gametype|singles\n|gen|9\n|tier|[Gen 9] UU\n|clearpoke\n|poke|p1|Krookodile, M|\n|poke|p2|Reuniclus, F|\n|start\n|switch|p1a: Krookodile|Krookodile, M|100/100\n|switch|p2a: Reuniclus|Reuniclus, F|100/100\n|turn|1');
          this.emit('>battle-gen9uu-spectate1\n|move|p1a: Krookodile|Knock Off|p2a: Reuniclus\n|-supereffective|p2a: Reuniclus\n|-damage|p2a: Reuniclus|38/100\n|turn|2');
        }
        if (message.includes('/search gen9ou')) {
          this.emit('|updatesearch|{"searching":["gen9ou"],"games":{}}');
          localStorage.setItem('__mockBattleStarted', '1');
          setTimeout(() => {
            this.emitBattle();
          }, 250);
        }
      }

      close() {
        this.readyState = MockPsWebSocket.CLOSED;
        this.onclose?.(new Event('close'));
        this.dispatchEvent(new Event('close'));
      }

      addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        super.addEventListener(type, listener);
      }

      removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        super.removeEventListener(type, listener);
      }

      emit(data: string) {
        const event = new MessageEvent('message', { data });
        this.onmessage?.(event);
        this.dispatchEvent(event);
      }

      emitBattle() {
        // Real servers always send |gen| and |tier|; the engine needs them to
        // resolve species in the right generation.
        this.emit('>battle-gen9ou-1\n|init|battle\n|title|CodexTester vs. MockRival\n|player|p1|CodexTester|266|1000\n|player|p2|MockRival|1|1000\n|gametype|singles\n|gen|9\n|tier|[Gen 9] OU');
        this.emit('>battle-gen9ou-1\n|clearpoke\n|poke|p1|Iron Valiant, L80\n|poke|p1|Heatran, L80\n|poke|p1|Dragapult, L80\n|poke|p2|Great Tusk, L80\n|poke|p2|Gholdengo, L80\n|poke|p2|Dragonite, L80\n|start\n|switch|p1a: Iron Valiant|Iron Valiant, L80|156/200\n|switch|p2a: Great Tusk|Great Tusk, L80|88/200\n|turn|12');
        this.emit(`>battle-gen9ou-1\n|request|${battleRequest}`);
      }
    }

    // Stand in for the login-server proxy. Guest names get an assertion;
    // `RegisteredName` returns the bare `;` a real server sends when a name
    // needs a password.
    const realFetch = window.fetch.bind(window);
    const actionCalls: string[] = [];
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes('/api/action')) return realFetch(input as RequestInfo, init);

      const body = new URLSearchParams(String(init?.body ?? ''));
      actionCalls.push(body.toString());
      localStorage.setItem('__mockActionCalls', JSON.stringify(actionCalls));

      const act = body.get('act');
      if (act === 'getassertion') {
        const userid = body.get('userid') || '';
        if (userid === 'registeredname') return Promise.resolve(new Response(';'));
        return Promise.resolve(new Response(`4|mock-assertion-for-${userid}`));
      }
      if (act === 'login') {
        const ok = body.get('pass') === 'correct-horse';
        return Promise.resolve(new Response(ok ?
          `]${JSON.stringify({ assertion: '4|mock-assertion-registered', curuser: { loggedin: true, username: body.get('name') } })}` :
          `]${JSON.stringify({ actionsuccess: false, error: 'Wrong password.' })}`));
      }
      return Promise.resolve(new Response(''));
    }) as typeof window.fetch;

    Object.assign(window, {
      WebSocket: MockPsWebSocket,
      __mockPsSent: sent,
      __mockPsSockets: sockets,
    });
  });
}
