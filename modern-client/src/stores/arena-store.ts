import { create } from 'zustand';
import { buildBattleCommand, demoBattle, type ArenaBattle, type BattleChoice, type PokemonSet } from '../compat/battle-adapter';
import { ProtocolClient, type ConnectionState } from '../compat/protocol-client';

type SearchState = 'idle' | 'searching';

type ArenaState = {
  username: string;
  connection: ConnectionState;
  notifications: number;
  selectedFormat: string;
  searchState: SearchState;
  battle: ArenaBattle;
  hardcoreMode: boolean;
  protocol: ProtocolClient;
  setConnection: (state: ConnectionState) => void;
  setSelectedFormat: (format: string) => void;
  startSearch: () => void;
  cancelSearch: () => void;
  submitBattleChoice: (choice: BattleChoice | PokemonSet) => void;
  recordBattleEvent: (event: string) => void;
  sendBattleChat: (message: string) => void;
  toggleHardcore: (checked: boolean) => void;
};

export const useArenaStore = create<ArenaState>((set, get) => ({
  username: 'Guest Player',
  connection: 'connected',
  notifications: 2,
  selectedFormat: 'Gen 9 OU',
  searchState: 'idle',
  battle: demoBattle,
  hardcoreMode: false,
  protocol: new ProtocolClient(),
  setConnection: connection => set({ connection }),
  setSelectedFormat: selectedFormat => set({ selectedFormat }),
  startSearch: () => {
    const { protocol, selectedFormat } = get();
    protocol.send(`/search ${selectedFormat.toLowerCase().replaceAll(' ', '')}`);
    set({ searchState: 'searching', notifications: 3 });
  },
  cancelSearch: () => {
    get().protocol.send('/cancelsearch');
    set({ searchState: 'idle' });
  },
  submitBattleChoice: choice => {
    const command = 'cmd' in choice ? choice.cmd : `/switch ${choice.slot}`;
    const logLine = buildBattleCommand(choice);
    get().protocol.send(command);
    set(state => ({
      battle: {
        ...state.battle,
        log: [logLine, ...state.battle.log].slice(0, 8),
      },
    }));
  },
  recordBattleEvent: event => {
    set(state => ({
      battle: {
        ...state.battle,
        log: [event, ...state.battle.log].slice(0, 8),
      },
    }));
  },
  sendBattleChat: message => {
    const trimmed = message.trim();
    if (!trimmed) return;
    set(state => ({
      battle: {
        ...state.battle,
        chat: [...state.battle.chat, { user: state.username, message: trimmed }].slice(-8),
      },
    }));
  },
  toggleHardcore: hardcoreMode => set({ hardcoreMode }),
}));
