import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import type { FormatOption } from '../stores/arena-store';

export function FormatSelector({ value, onValueChange, formats }: {
  value: string;
  onValueChange: (value: string) => void;
  formats: FormatOption[];
}) {
  const selected = formats.find(format => format.id === value);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="format-trigger" aria-label="Select battle format">
        <span>{selected?.name || value}</span>
        <ChevronDown size={16} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-surface" align="start">
          {formats.map(format => (
            <DropdownMenu.Item className="menu-item" key={format.id} onSelect={() => onValueChange(format.id)}>
              {format.name}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
