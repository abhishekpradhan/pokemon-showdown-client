import * as Dialog from '@radix-ui/react-dialog';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SearchableSelect } from './searchable-select';

describe('SearchableSelect keyboard navigation', () => {
  it('traverses the visible grouped order once and selects exactly once through a portal', () => {
    const onValueChange = vi.fn();
    render(
      <SearchableSelect
        ariaLabel="Species"
        value="a"
        onValueChange={onValueChange}
        options={[
          { value: 'a', label: 'A', group: 'First' },
          { value: 'b', label: 'B', group: 'Second' },
          { value: 'disabled', label: 'Unavailable', group: 'First', disabled: true },
          { value: 'c', label: 'C', group: 'First' },
        ]}
      />,
    );
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

  it('clears a dismissed search and exits the popup on Tab without selecting', () => {
    const onValueChange = vi.fn();
    render(
      <>
        <SearchableSelect
          ariaLabel="Format"
          options={[
            { value: 'ou', label: 'OU' },
            { value: 'uu', label: 'UU' },
          ]}
          onValueChange={onValueChange}
        />
        <button>Outside</button>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Format' });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'missing' } });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    fireEvent.click(trigger);
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Tab' });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('keeps a modal popup inside its focus scope and consumes only the first Escape', async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>Challenge</Dialog.Title>
            <Dialog.Description>Select a format</Dialog.Description>
            <SearchableSelect
              ariaLabel="Format"
              options={[{ value: 'ou', label: 'OU' }]}
              onValueChange={vi.fn()}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Format' });
    fireEvent.click(trigger);
    const input = screen.getByRole('combobox');
    expect(input.closest('[role=dialog]')).toBe(screen.getByRole('dialog'));
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
