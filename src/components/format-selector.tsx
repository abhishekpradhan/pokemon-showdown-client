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
      // One distinguishing fact per row — the repeated qualifier lists read
      // as noise at a glance.
      description: !format.searchShow ? 'Challenge only' :
        format.team === false ? 'Preset team' : 'Team required',
      meta: format.team === false ? 'Preset' : 'Team',
    }))}
    placeholder="Select format"
    value={value}
    onValueChange={onValueChange}
  />;
}
