import { Check, ChevronDown, Search } from 'lucide-react';
import { type CSSProperties, type KeyboardEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // A modal's focus scope requires the popup to remain its DOM descendant.
  // The native top layer lets that descendant escape scrolling/transformed
  // dialog ancestors without moving it outside the modal's focus boundary.
  const topLayer = !!portalContainer && portalContainer !== document.body && typeof HTMLElement.prototype.showPopover === 'function';
  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewport = window.visualViewport;
    let leftEdge = (viewport?.offsetLeft || 0) + 8;
    let topEdge = (viewport?.offsetTop || 0) + 8;
    let rightEdge = leftEdge + (viewport?.width || window.innerWidth) - 16;
    let bottomEdge = topEdge + (viewport?.height || window.innerHeight) - 16;
    const local = portalContainer && portalContainer !== document.body && !topLayer ? portalContainer : null;
    const localRect = local?.getBoundingClientRect();
    if (localRect) {
      leftEdge = Math.max(leftEdge, localRect.left + 8);
      topEdge = Math.max(topEdge, localRect.top + 8);
      rightEdge = Math.min(rightEdge, localRect.right - 8);
      bottomEdge = Math.min(bottomEdge, localRect.bottom - 8);
    }
    const below = Math.max(0, bottomEdge - rect.bottom - 8);
    const above = Math.max(0, rect.top - topEdge - 8);
    const up = below < 300 && above > below;
    const height = Math.max(0, Math.min(420, bottomEdge - topEdge, up ? above : below));
    const width = Math.max(0, Math.min(Math.max(rect.width, 340), rightEdge - leftEdge));
    const left = Math.max(leftEdge, Math.min(rect.left, rightEdge - width));
    const top = Math.max(topEdge, Math.min(up ? rect.top - height - 8 : rect.bottom + 8, bottomEdge - height));
    setPopStyle({
      position: local ? 'absolute' : 'fixed',
      margin: 0,
      inset: 'auto',
      left: left - (localRect?.left || 0) - (local?.clientLeft || 0) + (local?.scrollLeft || 0),
      top: top - (localRect?.top || 0) - (local?.clientTop || 0) + (local?.scrollTop || 0),
      width,
      maxHeight: height,
    });
  }, [portalContainer, topLayer]);

  const close = () => { setOpen(false); setQuery(''); };

  // Close only when focus SETTLES outside — transient null-focus hops (a
  // portal input mounting, dev double-effects) must not dismiss the list.
  const closeIfFocusLeft = () => {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (rootRef.current?.contains(active) || popRef.current?.contains(active)) return;
      close();
    });
  };

  // Clicking anywhere outside closes, focus or not.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Radix observes Escape on document capture. Handle the innermost popup
    // first so dismissing it does not also dismiss its enclosing dialog.
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault(); event.stopPropagation();
      close(); triggerRef.current?.focus();
    };
    window.addEventListener('keydown', onEscape, true);
    return () => window.removeEventListener('keydown', onEscape, true);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    if (topLayer && popRef.current && !popRef.current.matches(':popover-open')) popRef.current.showPopover();
    updatePosition();
    searchRef.current?.focus({ preventScroll: true });
    // Scrolls and resizes anywhere move the trigger — follow it rather than
    // closing; unrelated container scrolls (a feed filling in) must not
    // dismiss an open list.
    let frame = 0;
    const follow = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(updatePosition); };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    window.visualViewport?.addEventListener('resize', follow);
    window.visualViewport?.addEventListener('scroll', follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
      window.visualViewport?.removeEventListener('resize', follow);
      window.visualViewport?.removeEventListener('scroll', follow);
    };
  }, [open, topLayer, updatePosition]);
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

  const enabledOptions = useMemo(() => grouped.flatMap(section => section.options).filter(option => !option.disabled), [grouped]);

  const enabledIndices = useMemo(() => new Map(enabledOptions.map((option, index) => [option.value, index])), [enabledOptions]);
  const optionId = (optionValue: string) => `${ariaLabel.replace(/\s+/g, '-').toLowerCase()}-${encodeURIComponent(optionValue)}`;

  const choose = (nextValue: string) => {
    onValueChange(nextValue);
    close();
  };

  const openSelect = () => {
    setPortalContainer(rootRef.current?.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]') || document.body);
    setOpen(true);
    setQuery('');
    setActiveIndex(Math.max(0, enabledOptions.findIndex(option => option.value === value)));
  };

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape'].includes(event.key)) event.stopPropagation();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openSelect();
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
        openSelect();
      } else if (enabledOptions[activeIndex]) {
        event.preventDefault();
        choose(enabledOptions[activeIndex].value);
        triggerRef.current?.focus();
      }
      return;
    }
    if (open && event.key === 'Tab') {
      // Native Tab navigation continues from the trigger's place in the
      // form, instead of traversing every option or the end-of-body portal.
      close();
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
          if (open) close(); else openSelect();
        }}
      >
        <span>
          <strong>{selected?.label || value || placeholder}</strong>
          {selected?.meta && <em>{selected.meta}</em>}
        </span>
        <ChevronDown size={16} aria-hidden />
      </button>

      {open && createPortal(
        <div
          className="select-popover"
          ref={popRef}
          style={popStyle}
          popover={topLayer ? 'manual' : undefined}
          tabIndex={-1}
        >
          <label className="select-search">
            <Search size={15} aria-hidden />
            <input
              autoFocus
              ref={searchRef}
              aria-label={`${ariaLabel} filter`}
              aria-activedescendant={enabledOptions[activeIndex] ? optionId(enabledOptions[activeIndex].value) : undefined}
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
          <div className="select-options" role="listbox" aria-label={ariaLabel} id={`${ariaLabel.replace(/\s+/g, '-').toLowerCase()}-options`}>
            {grouped.length ? grouped.map(section => (
              <div className="select-section" key={section.group}>
                <span>{section.group}</span>
                {section.options.map(option => {
                  const enabledIndex = enabledIndices.get(option.value) ?? -1;
                  return (
                  <button
                    ref={element => { if (enabledIndex >= 0) optionRefs.current[enabledIndex] = element; }}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    id={optionId(option.value)}
                    aria-selected={option.value === value}
                    className={clsx('select-option', option.value === value && 'is-selected', enabledIndex === activeIndex && 'is-active')}
                    disabled={option.disabled}
                    key={option.value}
                    onMouseDown={event => event.preventDefault()}
                    onMouseEnter={() => enabledIndex >= 0 && setActiveIndex(enabledIndex)}
                    onClick={() => { choose(option.value); triggerRef.current?.focus(); }}
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
        portalContainer || document.body
      )}
    </div>
  );
}
