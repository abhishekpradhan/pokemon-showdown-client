import { toId } from './protocol-parsers';

type ListPreference = 'ignoredUsers' | 'mutedRooms' | 'autojoinRooms' | 'highlights';

/** Store the same identifiers that protocol rendering and notification checks compare. */
export function normalizePreferenceList(key: ListPreference, text: string): string[] {
  return [
    ...new Set(
      text
        .split(',')
        .map(value => {
          const trimmed = value.trim().toLowerCase();
          if (key === 'ignoredUsers') return toId(trimmed);
          if (key === 'mutedRooms' || key === 'autojoinRooms') return trimmed.replace(/[^a-z0-9-]/g, '');
          return trimmed;
        })
        .filter(value => value && value.length <= 120),
    ),
  ].slice(0, 100);
}
