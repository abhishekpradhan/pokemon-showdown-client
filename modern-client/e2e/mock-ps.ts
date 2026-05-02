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
          const name = message.split('/trn ')[1]?.split(',')[0]?.trim() || 'CodexTester';
          if (name === 'TakenName') {
            setTimeout(() => this.emit('|nametaken|TakenName|That name is already registered.'), 250);
          } else {
            setTimeout(() => this.emit(`|updateuser|${name}|1|0`), 350);
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
        this.emit('>battle-gen9ou-1\n|init|battle\n|title|CodexTester vs. MockRival\n|player|p1|CodexTester|1000\n|player|p2|MockRival|1000');
        this.emit(`>battle-gen9ou-1\n|request|${battleRequest}`);
      }
    }

    Object.assign(window, {
      WebSocket: MockPsWebSocket,
      __mockPsSent: sent,
      __mockPsSockets: sockets,
    });
  });
}
