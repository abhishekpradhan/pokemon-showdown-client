import { Check, ChevronDown, Search } from 'lucide-react';
import { type CSSProperties, type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [popStyle, setPopStyle] = useState<CSSProperties>();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The list renders in a body portal with fixed coordinates: no ancestor's
  // overflow can ever clip it (cards, panels and inspectors all did). It
  // opens toward whichever side of the trigger has more room and caps its
  // height to that side's actual space. Layout effect: settled pre-paint.
  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 72; // keep clear of the topbar
    const up = below < 340 && above > below;
    const width = Math.min(Math.max(rect.width, 340), window.innerWidth - 24);
    const left = Math.min(rect.left, window.innerWidth - width - 12);
    setPopStyle({
      position: 'fixed',
      left,
      width,
      maxHeight: Math.max(180, Math.min(420, up ? above : below)),
      ...(up ? { bottom: window.innerHeight - rect.top + 8, top: 'auto' } : { top: rect.bottom + 8, bottom: 'auto' }),
    });
  };

  // Close only when focus SETTLES outside — transient null-focus hops (a
  // portal input mounting, dev double-effects) must not dismiss the list.
  const closeIfFocusLeft = () => {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (rootRef.current?.contains(active) || popRef.current?.contains(active)) return;
      setOpen(false);
    });
  };

  // Clicking anywhere outside closes, focus or not.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    // Scrolls and resizes anywhere move the trigger — follow it rather than
    // closing; unrelated container scrolls (a feed filling in) must not
    // dismiss an open list.
    const follow = () => requestAnimationFrame(updatePosition);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [open]);
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
      onBlur={closeIfFocusLeft}
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

      {open && createPortal(
        <div
          className="select-popover"
          ref={popRef}
          style={popStyle}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          onBlur={closeIfFocusLeft}
        >
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
                    <span className="select-option-gutter" aria-hidden>
                      {option.value === value && <Check size={14} />}
                    </span>
                    <strong className="select-option-label">{option.label}</strong>
                    {option.description && <small className="select-option-meta">{option.description}</small>}
                  </button>
                  );
                })}
              </div>
            )) : <p className="select-empty">{emptyLabel}</p>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
