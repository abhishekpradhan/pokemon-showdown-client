import { vi } from 'vitest';
import { __testables, cryUrl, playCry } from './sound';

describe('battle sound', () => {
  beforeEach(() => {
    __testables.reset();
    vi.unstubAllGlobals();
  });

  it('builds cry URLs from species names, id-normalized', () => {
    expect(cryUrl('Iron Valiant')).toBe('https://play.pokemonshowdown.com/audio/cries/ironvaliant.mp3');
    expect(cryUrl("Farfetch'd")).toBe('https://play.pokemonshowdown.com/audio/cries/farfetchd.mp3');
    expect(cryUrl('')).toBeNull();
  });

  it('stays silent until the page has seen a user gesture', () => {
    const play = vi.fn().mockResolvedValue(undefined);
    // A constructible double: `new` on an arrow implementation throws.
    const AudioMock = vi.fn(function () {
      return { play, volume: 0, currentTime: 0 };
    });
    vi.stubGlobal('Audio', AudioMock);

    playCry('Pikachu');
    expect(AudioMock).not.toHaveBeenCalled();

    __testables.markUnlocked();
    playCry('Pikachu');
    expect(AudioMock).toHaveBeenCalledWith('https://play.pokemonshowdown.com/audio/cries/pikachu.mp3');
    expect(play).toHaveBeenCalled();
  });

  it('reuses one element per species and survives play() rejection', () => {
    const play = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    const AudioMock = vi.fn(function () {
      return { play, volume: 0, currentTime: 0 };
    });
    vi.stubGlobal('Audio', AudioMock);
    __testables.markUnlocked();

    playCry('Heatran');
    playCry('Heatran');
    expect(AudioMock).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(2);
  });
});
