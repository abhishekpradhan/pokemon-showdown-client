import { fireEvent, render, screen } from '@testing-library/react';
import { SearchableSelect } from './searchable-select';

describe('SearchableSelect keyboard navigation', () => {
  it('traverses the visible grouped order once and selects exactly once through a portal', () => {
    const onValueChange = vi.fn();
    render(<SearchableSelect ariaLabel="Species" value="a" onValueChange={onValueChange} options={[
      { value: 'a', label: 'A', group: 'First' },
      { value: 'b', label: 'B', group: 'Second' },
      { value: 'disabled', label: 'Unavailable', group: 'First', disabled: true },
      { value: 'c', label: 'C', group: 'First' },
    ]} />);
    const trigger = screen.getByRole('button', { name: 'Species' });
    fireEvent.click(trigger);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', 'species-c');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', 'species-b');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('b');
    expect(trigger).toHaveFocus();
  });

  it('preserves an out-of-filter value and restores focus on Escape', () => {
    render(<SearchableSelect ariaLabel="Move" value="Unlisted move" options={[]} onValueChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Move' });
    expect(trigger).toHaveTextContent('Unlisted move');
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
