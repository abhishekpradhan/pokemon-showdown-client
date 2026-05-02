import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';

const formats = ['Gen 9 OU', 'Gen 9 Random Battle', 'Gen 9 Ubers', 'National Dex', 'VGC 2026'];

export function FormatSelector({ value, onValueChange }: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="format-trigger">
        <span>{value}</span>
        <ChevronDown size={16} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-surface" align="start">
          {formats.map(format => (
            <DropdownMenu.Item className="menu-item" key={format} onSelect={() => onValueChange(format)}>
              {format}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
