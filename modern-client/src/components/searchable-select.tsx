import { Check, ChevronDown, Search } from 'lucide-react';
import { type KeyboardEvent, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';

export type SearchableSelectOption = {
  value: string;
  label: string;
  group?: string;
  description?: string;
  meta?: string;
  disabled?: boolean;
};

export function SearchableSelect({
  ariaLabel,
  emptyLabel = 'No matches',
  onValueChange,
  options,
  placeholder = 'Select',
  value,
}: {
  ariaLabel: string;
  emptyLabel?: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  value?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value);
  const visibleOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(option => [
      option.label,
      option.group || '',
      option.description || '',
      option.meta || '',
    ].join(' ').toLowerCase().includes(needle));
  }, [options, query]);

  const grouped = useMemo(() => {
    const sections: Array<{ group: string; options: SearchableSelectOption[] }> = [];
    for (const option of visibleOptions) {
      const group = option.group || 'Options';
      const section = sections.find(entry => entry.group === group);
      if (section) section.options.push(option);
      else sections.push({ group, options: [option] });
    }
    return sections;
  }, [visibleOptions]);

  const choose = (nextValue: string) => {
    onValueChange(nextValue);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div
      className="searchable-select"
      ref={rootRef}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="format-trigger select-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        <span>
          <strong>{selected?.label || placeholder}</strong>
          {selected?.meta && <em>{selected.meta}</em>}
        </span>
        <ChevronDown size={16} aria-hidden />
      </button>

      {open && (
        <div className="select-popover" role="listbox" aria-label={ariaLabel} tabIndex={-1}>
          <label className="select-search">
            <Search size={15} aria-hidden />
            <input
              autoFocus
              aria-label={`${ariaLabel} filter`}
              placeholder="Filter"
              value={query}
              onChange={event => setQuery(event.currentTarget.value)}
            />
          </label>
          <div className="select-options">
            {grouped.length ? grouped.map(section => (
              <div className="select-section" key={section.group}>
                <span>{section.group}</span>
                {section.options.map(option => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    className={clsx('select-option', option.value === value && 'is-selected')}
                    disabled={option.disabled}
                    key={option.value}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => choose(option.value)}
                  >
                    <span>
                      <strong>{option.label}</strong>
                      {option.description && <small>{option.description}</small>}
                    </span>
                    {option.value === value && <Check size={15} aria-hidden />}
                  </button>
                ))}
              </div>
            )) : <p className="select-empty">{emptyLabel}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
