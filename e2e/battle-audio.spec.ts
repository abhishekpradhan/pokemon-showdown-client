import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { installMockPs } from './mock-ps';

const room = 'battle-audio-workflow';
type AudioRecord = {
  originalSrc: string;
  src: string;
  volume: number;
  paused: boolean;
  playCalls: number;
  pauseCalls: number;
  loadCalls: number;
  preload: string;
  loop: boolean;
};
type AudioWindow = Window & {
  __audioRecords: AudioRecord[];
  __audioContextCount: number;
  __mockPsSockets: Array<{ readyState: number; emit: (line: string) => void }>;
};

async function installAudioProbe(page: Page, musicEnabled: boolean) {
  await installMockPs(page);
  await page.addInitScript(
    ({ musicEnabled }) => {
      localStorage.setItem(
        'ps-arena-workspace-v1',
        JSON.stringify({
          version: 0,
          state: {
            soundEnabled: true,
            musicEnabled,
            musicTrack: 'dpp-trainer',
            musicVolume: 63,
            effectsVolume: 0,
            notificationVolume: 0,
            reducedMotion: true,
          },
        }),
      );
      const audioRecords: FakeAudio[] = [];
      class FakeAudio extends EventTarget {
        originalSrc: string;
        src: string;
        volume = 1;
        currentTime = 0;
        paused = true;
        playCalls = 0;
        pauseCalls = 0;
        loadCalls = 0;
        preload = '';
        loop = false;
        constructor(src = '') {
          super();
          this.originalSrc = this.src = src;
          audioRecords.push(this);
        }
        play() {
          this.paused = false;
          this.playCalls++;
          return Promise.resolve();
        }
        pause() {
          this.paused = true;
          this.pauseCalls++;
        }
        load() {
          this.loadCalls++;
        }
        removeAttribute(name: string) {
          if (name === 'src') this.src = '';
        }
      }
      class FakeAudioContext {
        state = 'running';
        currentTime = 0;
        destination = {};
        constructor() {
          (window as unknown as { __audioContextCount: number }).__audioContextCount++;
        }
        resume() {
          this.state = 'running';
          return Promise.resolve();
        }
        suspend() {
          this.state = 'suspended';
          return Promise.resolve();
        }
        createOscillator() {
          return {
            type: 'sine',
            frequency: { value: 0 },
            onended: undefined as (() => void) | undefined,
            connect: <T>(target: T) => target,
            disconnect() {},
            start() {},
            stop() {
              this.onended?.();
            },
          };
        }
        createGain() {
          return {
            gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
            connect: <T>(target: T) => target,
            disconnect() {},
          };
        }
      }
      Object.assign(window, {
        Audio: FakeAudio,
        AudioContext: FakeAudioContext,
        __audioRecords: audioRecords,
        __audioContextCount: 0,
      });
    },
    { musicEnabled },
  );
}

const music = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as AudioWindow).__audioRecords
      .filter(audio => !audio.originalSrc.includes('/cries/'))
      .map(({ originalSrc, src, volume, paused, playCalls, pauseCalls, loadCalls, preload, loop }) => ({
        originalSrc,
        src,
        volume,
        paused,
        playCalls,
        pauseCalls,
        loadCalls,
        preload,
        loop,
      })),
  );
const emit = (page: Page, lines: string) =>
  page.evaluate(
    ({ room, lines }) => {
      (window as unknown as AudioWindow).__mockPsSockets[0].emit(`>${room}\n${lines}`);
    },
    { room, lines },
  );
const settled = (page: Page) =>
  page.evaluate(
    () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
const returnToBattle = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Open sessions' })
    .getByRole('button', { name: /^Listener v Rival/ })
    .click();

async function openBattle(page: Page) {
  await page.goto(`/battle/${room}`);
  await page.waitForFunction(() => (window as unknown as AudioWindow).__mockPsSockets?.[0]?.readyState === 1);
  await emit(
    page,
    [
      '|init|battle',
      '|title|Audio workflow',
      '|gen|9',
      '|gametype|singles',
      '|player|p1|Listener',
      '|player|p2|Rival',
      '|start',
      '|switch|p1a: Pikachu|Pikachu|100/100',
      '|switch|p2a: Eevee|Eevee|100/100',
      '|turn|1',
    ].join('\n'),
  );
  await expect(page.locator('.battle-field')).toBeVisible();
  await settled(page);
}

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate(hidden => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: hidden ? 'hidden' : 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('focused battle music waits for a gesture, uses one stream, and follows visibility, navigation, mute and battle end', async ({
  page,
}) => {
  await installAudioProbe(page, true);
  await openBattle(page);
  expect(await music(page)).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as AudioWindow).__audioContextCount)).toBe(0);

  await page.keyboard.press('Shift');
  await expect
    .poll(() => music(page))
    .toEqual([
      expect.objectContaining({
        originalSrc: 'https://play.pokemonshowdown.com/audio/dpp-trainer.mp3',
        paused: false,
        volume: 0.63,
        playCalls: 1,
        preload: 'none',
        loop: true,
      }),
    ]);
  await emit(page, Array.from({ length: 12 }, (_, index) => `|turn|${index + 2}`).join('\n'));
  await settled(page);
  expect(await music(page)).toEqual([expect.objectContaining({ paused: false, playCalls: 1 })]);

  await setHidden(page, true);
  await expect.poll(() => music(page)).toEqual([expect.objectContaining({ paused: true })]);
  await emit(page, '|turn|14\n|c|Rival|Still here');
  await settled(page);
  expect(await music(page)).toEqual([expect.objectContaining({ paused: true, playCalls: 1 })]);
  await setHidden(page, false);
  await expect.poll(() => music(page)).toEqual([expect.objectContaining({ paused: false, playCalls: 2 })]);

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect.poll(() => music(page)).toEqual([expect.objectContaining({ paused: true })]);
  await returnToBattle(page);
  await expect.poll(() => music(page)).toEqual([expect.objectContaining({ paused: false, volume: 0.63 })]);
  await page.getByRole('button', { name: 'Mute battle sounds', exact: true }).click();
  await expect.poll(() => music(page)).toEqual([expect.objectContaining({ paused: true, volume: 0.63 })]);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('ps-arena-workspace-v1')!).state.musicVolume),
  ).toBe(63);
  await page.getByRole('button', { name: 'Unmute battle sounds', exact: true }).click();
  await expect.poll(() => music(page)).toEqual([expect.objectContaining({ paused: false, volume: 0.63 })]);

  await emit(page, '|win|Listener');
  await expect.poll(() => music(page)).toEqual([expect.objectContaining({ paused: true })]);
  const ended = await music(page);
  await page.keyboard.press('Shift');
  await settled(page);
  expect(await music(page)).toEqual([
    expect.objectContaining({ paused: true, playCalls: ended[0].playCalls }),
  ]);
});

test('music stays optional, applies settings on return to battle, and releases the previous track', async ({
  page,
}) => {
  await installAudioProbe(page, false);
  await openBattle(page);
  await page.keyboard.press('Shift');
  await settled(page);
  expect(await music(page)).toEqual([]);

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Battle music', exact: true }).check();
  await page.getByRole('slider', { name: 'Music volume', exact: true }).fill('41');
  await page.getByLabel('Music track', { exact: true }).selectOption('xy-trainer');
  await settled(page);
  expect(await music(page)).toEqual([]);
  await returnToBattle(page);
  await expect
    .poll(() => music(page))
    .toEqual([
      expect.objectContaining({
        originalSrc: 'https://play.pokemonshowdown.com/audio/xy-trainer.mp3',
        paused: false,
        volume: 0.41,
      }),
    ]);

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Music track', { exact: true }).selectOption('bw-trainer');
  await returnToBattle(page);
  await expect
    .poll(() => music(page))
    .toEqual([
      expect.objectContaining({
        originalSrc: 'https://play.pokemonshowdown.com/audio/xy-trainer.mp3',
        src: '',
        paused: true,
        loadCalls: 1,
      }),
      expect.objectContaining({
        originalSrc: 'https://play.pokemonshowdown.com/audio/bw-trainer.mp3',
        paused: false,
        volume: 0.41,
      }),
    ]);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Battle music', exact: true }).uncheck();
  await returnToBattle(page);
  await settled(page);
  expect((await music(page)).every(audio => audio.paused)).toBe(true);
  expect(await music(page)).toHaveLength(2);
});
