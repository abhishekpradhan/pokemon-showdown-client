export const SERVER_LANGUAGES = {
  english: 'English', german: 'Deutsch', spanish: 'Español', french: 'Français',
  italian: 'Italiano', dutch: 'Nederlands', portuguese: 'Português', turkish: 'Türkçe',
  hindi: 'हिन्दी', japanese: '日本語', simplifiedchinese: '简体中文', traditionalchinese: '繁體中文',
} as const;
export type ServerLanguage = keyof typeof SERVER_LANGUAGES;
export const isServerLanguage = (value: unknown): value is ServerLanguage => typeof value === 'string' && Object.hasOwn(SERVER_LANGUAGES, value);

export const BACKGROUNDS = { none: 'Default', ocean: 'Ocean', dusk: 'Dusk', forest: 'Forest', custom: 'Your image' } as const;
export type Background = keyof typeof BACKGROUNDS;
export const isBackground = (value: unknown): value is Background => typeof value === 'string' && Object.hasOwn(BACKGROUNDS, value);

export const MUSIC_TRACKS = {
  'bw-trainer': 'Black & White — Trainer',
  'dpp-trainer': 'Diamond & Pearl — Trainer',
  'xy-trainer': 'X & Y — Trainer',
} as const;
export type MusicTrack = keyof typeof MUSIC_TRACKS;
export const isMusicTrack = (value: unknown): value is MusicTrack => typeof value === 'string' && Object.hasOwn(MUSIC_TRACKS, value);
export const clampVolume = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
