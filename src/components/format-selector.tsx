import { SearchableSelect } from './searchable-select';
import type { FormatOption } from '../stores/arena-store';

export function FormatSelector({ value, onValueChange, formats }: {
  value: string;
  onValueChange: (value: string) => void;
  formats: FormatOption[];
}) {
  return <SearchableSelect
    ariaLabel="Select battle format"
    emptyLabel="No formats match"
    options={formats.map(format => ({
      value: format.id,
      label: format.name,
      group: format.section || 'Formats',
      description: [
        format.searchShow ? 'Searchable' : 'Not searchable',
        format.team === false ? 'Preset team' : 'Team required',
        format.challengeShow && !format.searchShow ? 'Challenge only' : '',
      ].filter(Boolean).join(' · '),
      meta: format.team === false ? 'Preset' : 'Team',
    }))}
    placeholder="Select format"
    value={value}
    onValueChange={onValueChange}
  />;
}
