import { vi } from 'vitest';
import { BattleMusic } from './music';

describe('battle music lifecycle', () => {
  const play = vi.fn().mockResolvedValue(undefined);
  const pause = vi.fn();
  const load = vi.fn();
  const removeAttribute = vi.fn();
  const instances: Array<{ volume: number; currentTime: number; listener?: () => void }> = [];
  beforeEach(() => {
    vi.clearAllMocks();
    instances.length = 0;
    vi.stubGlobal(
      'Audio',
      vi.fn(function () {
        const instance = {
          play,
          pause,
          load,
          removeAttribute,
          volume: 0,
          currentTime: 0,
          listener: undefined as (() => void) | undefined,
          addEventListener: (_event: string, callback: () => void) => {
            instance.listener = callback;
          },
        };
        instances.push(instance);
        return instance;
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  it('keeps one stream, applies independent volume, loops and releases tracks', () => {
    const music = new BattleMusic();
    music.sync(false, 'bw-trainer', 30);
    expect(instances).toHaveLength(0);
    music.sync(true, 'bw-trainer', 30);
    music.sync(true, 'bw-trainer', 80);
    expect(play).toHaveBeenCalledTimes(1);
    expect(instances[0].volume).toBe(0.8);
    instances[0].currentTime = 111;
    instances[0].listener?.();
    expect(instances[0].currentTime).toBe(14.629);
    music.sync(false, 'bw-trainer', 80);
    expect(pause).toHaveBeenCalledTimes(1);
    music.sync(true, 'bw-trainer', 80);
    expect(instances).toHaveLength(1);
    music.sync(true, 'xy-trainer', 999);
    expect(removeAttribute).toHaveBeenCalledWith('src');
    expect(instances).toHaveLength(2);
    expect(instances[1].volume).toBe(1);
    music.dispose();
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('allows a later gesture to retry rejected autoplay and zero volume pauses', async () => {
    play.mockRejectedValueOnce(new Error('Autoplay blocked'));
    const music = new BattleMusic();
    music.sync(true, 'bw-trainer', 30);
    await Promise.resolve();
    music.sync(true, 'bw-trainer', 30);
    expect(play).toHaveBeenCalledTimes(2);
    music.sync(true, 'bw-trainer', 0);
    expect(pause).toHaveBeenCalled();
    music.dispose();
  });
});
