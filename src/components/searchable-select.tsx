import { Check, ChevronDown, Search } from 'lucide-react';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
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

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabledOptions = visibleOptions.filter(option => !option.disabled);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(Math.max(0, enabledOptions.findIndex(option => option.value === value)));
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(current => (current + direction + enabledOptions.length) % Math.max(1, enabledOptions.length));
      return;
    }
    if (open && event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (open && event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, enabledOptions.length - 1));
      return;
    }
    if (event.key === 'Enter') {
      if (!open) {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(Math.max(0, enabledOptions.findIndex(option => option.value === value)));
      } else if (enabledOptions[activeIndex]) {
        event.preventDefault();
        choose(enabledOptions[activeIndex].value);
        triggerRef.current?.focus();
      }
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
      triggerRef.current?.focus();
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
        ref={triggerRef}
        type="button"
        className="format-trigger select-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen(current => !current);
          setActiveIndex(Math.max(0, visibleOptions.filter(option => !option.disabled).findIndex(option => option.value === value)));
        }}
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
              aria-activedescendant={visibleOptions.filter(option => !option.disabled)[activeIndex] ? `${ariaLabel.replace(/\s+/g, '-').toLowerCase()}-${visibleOptions.filter(option => !option.disabled)[activeIndex].value}` : undefined}
              aria-controls={`${ariaLabel.replace(/\s+/g, '-').toLowerCase()}-options`}
              role="combobox"
              aria-expanded="true"
              placeholder="Filter"
              value={query}
              onChange={event => {
                setQuery(event.currentTarget.value);
                setActiveIndex(0);
              }}
            />
          </label>
          <div className="select-options" id={`${ariaLabel.replace(/\s+/g, '-').toLowerCase()}-options`}>
            {grouped.length ? grouped.map(section => (
              <div className="select-section" key={section.group}>
                <span>{section.group}</span>
                {section.options.map(option => {
                  const enabledIndex = visibleOptions.filter(entry => !entry.disabled).findIndex(entry => entry.value === option.value);
                  return (
                  <button
                    ref={element => { if (enabledIndex >= 0) optionRefs.current[enabledIndex] = element; }}
                    type="button"
                    role="option"
                    id={`${ariaLabel.replace(/\s+/g, '-').toLowerCase()}-${option.value}`}
                    aria-selected={option.value === value}
                    className={clsx('select-option', option.value === value && 'is-selected', enabledIndex === activeIndex && 'is-active')}
                    disabled={option.disabled}
                    key={option.value}
                    onMouseDown={event => event.preventDefault()}
                    onMouseEnter={() => enabledIndex >= 0 && setActiveIndex(enabledIndex)}
                    onClick={() => choose(option.value)}
                  >
                    <span>
                      <strong>{option.label}</strong>
                      {option.description && <small>{option.description}</small>}
                    </span>
                    {option.value === value && <Check size={15} aria-hidden />}
                  </button>
                  );
                })}
              </div>
            )) : <p className="select-empty">{emptyLabel}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
