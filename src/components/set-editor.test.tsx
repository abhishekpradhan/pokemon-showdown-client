import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SetEditor } from './set-editor';
import { loadDex } from '../data/dex';

describe('format-aware set editor', () => {
  beforeAll(async () => {
    await loadDex();
  });

  it('offers inherited moves and lets permissive formats select any move', async () => {
    const onChange = vi.fn();
    render(<SetEditor set={{ species: 'Raichu', moves: [] }} formatId="gen9ou" onChange={onChange} />);
    await waitFor(() => expect(screen.getByText(/Raichu learnset/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Move 1' }));
    fireEvent.change(screen.getByRole('combobox', { name: /filter$/ }), { target: { value: 'Volt Tackle' } });
    fireEvent.click(screen.getByRole('option', { name: /Volt Tackle/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ moves: ['Volt Tackle'] }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show all moves and abilities' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move 1' }));
    fireEvent.change(screen.getByRole('combobox', { name: /filter$/ }), { target: { value: 'Spore' } });
    expect(screen.getAllByRole('option').map(option => option.textContent)).toContain('SporeStatus');
  });

  it('uses old-generation species and DV controls', () => {
    render(<SetEditor set={{ species: 'Pikachu', moves: [] }} formatId="gen2ou" onChange={vi.fn()} />);
    expect(screen.getByLabelText('HP DV')).toHaveValue(15);
    fireEvent.click(screen.getByRole('button', { name: 'Species' }));
    fireEvent.change(screen.getByRole('combobox', { name: /filter$/ }), {
      target: { value: 'Iron Valiant' },
    });
    expect(screen.queryByRole('option', { name: /Iron Valiant/ })).not.toBeInTheDocument();
  });

  it('clears moves and preserves all unrelated details', async () => {
    const onChange = vi.fn();
    render(
      <SetEditor
        set={{ species: 'Pikachu', moves: ['Thunderbolt'], gender: 'F', happiness: 0, ivs: { atk: 0 } }}
        formatId="gen9ou"
        onChange={onChange}
      />,
    );
    // Exercise the loaded species list, rather than scanning the temporary
    // all-moves fallback while its asynchronous learnset is still loading.
    await screen.findByText(/Pikachu learnset/);
    fireEvent.click(screen.getByRole('button', { name: 'Move 1' }));
    fireEvent.click(screen.getByRole('option', { name: 'Clear move' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ moves: [''], gender: 'F', happiness: 0, ivs: { atk: 0 } }),
    );
  });
});
