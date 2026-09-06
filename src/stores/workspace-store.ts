import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkspaceTheme = 'light' | 'dark' | 'system';

type WorkspaceState = {
  theme: WorkspaceTheme;
  notificationsEnabled: boolean;
  /** Battle audio: cries on switch-in and the your-move ping. */
  soundEnabled: boolean;
  timestamps: boolean;
  reducedMotion: boolean;
  volume: number;
  ignoredUsers: string[];
  mutedRooms: string[];
  highlights: string[];
  favoriteRooms: string[];
  autojoinRooms: string[];
  blockPms: boolean;
  blockChallenges: boolean;
  privateBattles: boolean;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  setTheme: (theme: WorkspaceTheme) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
};

type Preferences = Pick<WorkspaceState, 'timestamps' | 'reducedMotion' | 'volume' | 'ignoredUsers' | 'mutedRooms' | 'highlights' | 'favoriteRooms' | 'autojoinRooms' | 'blockPms' | 'blockChallenges' | 'privateBattles'>;

export const useWorkspaceStore = create<WorkspaceState>()(persist(set => ({
  theme: 'system',
  notificationsEnabled: true,
  soundEnabled: true,
  timestamps: true,
  reducedMotion: false,
  volume: 50,
  ignoredUsers: [],
  mutedRooms: [],
  highlights: [],
  favoriteRooms: [],
  autojoinRooms: [],
  blockPms: false,
  blockChallenges: false,
  privateBattles: false,
  setPreference: (key, value) => set({ [key]: value }),
  setTheme: theme => set({ theme }),
  setNotificationsEnabled: notificationsEnabled => set({ notificationsEnabled }),
  setSoundEnabled: soundEnabled => set({ soundEnabled }),
}), {
  name: 'ps-arena-workspace-v1',
  merge: (stored, current) => {
    if (!stored || typeof stored !== 'object') return current;
    const safe = { ...current };
    const data = stored as Record<string, unknown>;
    for (const key of ['notificationsEnabled', 'soundEnabled', 'timestamps', 'reducedMotion', 'blockPms', 'blockChallenges', 'privateBattles'] as const) {
      if (typeof data[key] === 'boolean') safe[key] = data[key];
    }
    if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system') safe.theme = data.theme;
    if (typeof data.volume === 'number' && Number.isFinite(data.volume)) safe.volume = Math.max(0, Math.min(100, data.volume));
    for (const key of ['ignoredUsers', 'mutedRooms', 'highlights', 'favoriteRooms', 'autojoinRooms'] as const) {
      if (Array.isArray(data[key])) safe[key] = data[key].filter((entry): entry is string => typeof entry === 'string' && entry.length <= 120).slice(0, 100);
    }
    return safe;
  },
}));
