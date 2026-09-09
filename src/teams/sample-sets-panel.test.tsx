import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SampleSetsPanel } from './sample-sets-panel';
import { fetchSampleSets, type SampleSet } from './sample-sets';
import type { TeamSet } from '../compat/team-store';

vi.mock('./sample-sets', async importOriginal => ({
  ...(await importOriginal<typeof import('./sample-sets')>()),
  fetchSampleSets: vi.fn(),
}));
const original: TeamSet = {
  species: 'Clefable',
  name: 'Moon friend',
  moves: ['Tackle'],
  happiness: 0,
  gender: 'F',
  shiny: true,
  ivs: { atk: 0 },
};
const samples: SampleSet[] = [
  {
    id: 'dex:Utility',
    name: 'Utility',
    source: 'analysis',
    set: {
      species: 'Clefable',
      moves: ['Moonblast', 'Moonlight'],
      item: 'Leftovers',
      evs: { hp: 252, def: 252, spd: 4 },
      nature: 'Bold',
    },
  },
];
beforeEach(() => {
  vi.mocked(fetchSampleSets).mockReset();
});

it('previews before explicit apply, preserves personal details, and prevents Undo from overwriting later edits', async () => {
  vi.mocked(fetchSampleSets).mockResolvedValue(samples);
  const changed = vi.fn();
  const view = render(<SampleSetsPanel set={original} format="gen9ou" onChange={changed} />);
  expect(fetchSampleSets).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Browse sample sets' }));
  await screen.findByRole('button', { name: 'Apply sample set' });
  expect(screen.getByLabelText('Sample set preview')).toHaveTextContent('Moon friend');
  expect(changed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply sample set' }));
  const next: TeamSet = changed.mock.calls[0][0];
  expect(next).toMatchObject({ ...original, moves: ['Moonblast', 'Moonlight'], item: 'Leftovers' });
  view.rerender(<SampleSetsPanel set={next} format="gen9ou" onChange={changed} />);
  expect(screen.getByRole('button', { name: 'Apply sample set' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Undo sample set' }));
  expect(changed).toHaveBeenLastCalledWith(original);
  view.rerender(<SampleSetsPanel set={original} format="gen9ou" onChange={changed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Apply sample set' }));
  view.rerender(<SampleSetsPanel set={{ ...next, evs: { hp: 244 } }} format="gen9ou" onChange={changed} />);
  expect(screen.queryByRole('button', { name: 'Undo sample set' })).not.toBeInTheDocument();
});

it('aborts closed and switched-set requests so late results cannot reach another Pokémon', async () => {
  let resolve = (_value: SampleSet[]) => {};
  vi.mocked(fetchSampleSets)
    .mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    )
    .mockResolvedValue([]);
  const view = render(<SampleSetsPanel key="clefable" set={original} format="gen9ou" onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Browse sample sets' }));
  const signal = vi.mocked(fetchSampleSets).mock.calls[0][2];
  view.rerender(
    <SampleSetsPanel
      key="pikachu"
      set={{ species: 'Pikachu', moves: [] }}
      format="gen9ou"
      onChange={vi.fn()}
    />,
  );
  expect(signal.aborted).toBe(true);
  resolve(samples);
  fireEvent.click(screen.getByRole('button', { name: 'Browse sample sets' }));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('No published sample sets for Pikachu'),
  );
  expect(screen.queryByRole('button', { name: 'Apply sample set' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close sample sets' }));
  expect(vi.mocked(fetchSampleSets).mock.calls[1][2].aborted).toBe(true);
});

it('offers a fresh retry after an error', async () => {
  vi.mocked(fetchSampleSets).mockRejectedValueOnce(new Error('HTTP 503')).mockResolvedValue(samples);
  render(<SampleSetsPanel set={original} format="gen9ou" onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Browse sample sets' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Retry sample sets' }));
  await screen.findByRole('button', { name: 'Apply sample set' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
