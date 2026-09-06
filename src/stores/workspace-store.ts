import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clampVolume, isBackground, isMusicTrack, isServerLanguage, type Background, type MusicTrack, type ServerLanguage } from '../preferences/options';
import { isPublicAvatar } from '../preferences/avatars';

export type WorkspaceTheme = 'light' | 'dark' | 'system';

type WorkspaceState = {
  theme: WorkspaceTheme;
  notificationsEnabled: boolean;
  /** Battle audio: cries on switch-in and the your-move ping. */
  soundEnabled: boolean;
  timestamps: boolean;
  reducedMotion: boolean;
  /** Legacy master value retained for migration and existing installations. */
  volume: number;
  effectsVolume: number;
  notificationVolume: number;
  musicVolume: number;
  musicEnabled: boolean;
  musicTrack: MusicTrack;
  serverLanguage: ServerLanguage;
  preferredAvatar: string;
  background: Background;
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

type Preferences = Pick<WorkspaceState, 'timestamps' | 'reducedMotion' | 'volume' | 'ignoredUsers' | 'mutedRooms' | 'highlights' | 'favoriteRooms' | 'autojoinRooms' | 'blockPms' | 'blockChallenges' | 'privateBattles' | 'effectsVolume' | 'notificationVolume' | 'musicVolume' | 'musicEnabled' | 'musicTrack' | 'serverLanguage' | 'preferredAvatar' | 'background'>;

export const useWorkspaceStore = create<WorkspaceState>()(persist(set => ({
  theme: 'system',
  notificationsEnabled: true,
  soundEnabled: true,
  timestamps: true,
  reducedMotion: false,
  volume: 50,
  effectsVolume: 50,
  notificationVolume: 50,
  musicVolume: 30,
  musicEnabled: false,
  musicTrack: 'bw-trainer',
  serverLanguage: 'english',
  preferredAvatar: '',
  background: 'none',
  ignoredUsers: [],
  mutedRooms: [],
  highlights: [],
  favoriteRooms: [],
  autojoinRooms: [],
  blockPms: false,
  blockChallenges: false,
  privateBattles: false,
  setPreference: (key, value) => set(key === 'volume' && typeof value === 'number' ? { volume: clampVolume(value), effectsVolume: clampVolume(value), notificationVolume: clampVolume(value) } : { [key]: value }),
  setTheme: theme => set({ theme }),
  setNotificationsEnabled: notificationsEnabled => set({ notificationsEnabled }),
  setSoundEnabled: soundEnabled => set({ soundEnabled }),
}), {
  name: 'ps-arena-workspace-v1',
  merge: (stored, current) => {
    if (!stored || typeof stored !== 'object') return current;
    const safe = { ...current };
    const data = stored as Record<string, unknown>;
    for (const key of ['notificationsEnabled', 'soundEnabled', 'musicEnabled', 'timestamps', 'reducedMotion', 'blockPms', 'blockChallenges', 'privateBattles'] as const) {
      if (typeof data[key] === 'boolean') safe[key] = data[key];
    }
    if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system') safe.theme = data.theme;
    if (typeof data.volume === 'number' && Number.isFinite(data.volume)) safe.volume = Math.max(0, Math.min(100, data.volume));
    safe.effectsVolume = safe.notificationVolume = safe.volume;
    for (const key of ['effectsVolume', 'notificationVolume', 'musicVolume'] as const) {
      if (typeof data[key] === 'number' && Number.isFinite(data[key])) safe[key] = clampVolume(data[key]);
    }
    if (isServerLanguage(data.serverLanguage)) safe.serverLanguage = data.serverLanguage;
    if (isPublicAvatar(data.preferredAvatar)) safe.preferredAvatar = data.preferredAvatar;
    if (isMusicTrack(data.musicTrack)) safe.musicTrack = data.musicTrack;
    if (isBackground(data.background)) safe.background = data.background;
    for (const key of ['ignoredUsers', 'mutedRooms', 'highlights', 'favoriteRooms', 'autojoinRooms'] as const) {
      if (Array.isArray(data[key])) safe[key] = data[key].filter((entry): entry is string => typeof entry === 'string' && entry.length <= 120).slice(0, 100);
    }
    return safe;
  },
}));
