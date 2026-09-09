import { SPRITE_HOST } from '../data/sprites';

/**
 * Battle audio: species cries on switch-in and a synthesized two-note ping
 * when it's your move. Cries stream from the official audio host (same
 * origin as sprites); the ping needs no asset.
 *
 * Browsers block audio until the page has seen a user gesture, so playback
 * silently no-ops until one arrives — and every play() rejection (missing
 * cry file, revoked permission) is swallowed: sound is garnish, never an
 * error path.
 */

let unlocked = false;
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlocked = true;
  };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
}

export const isAudioUnlocked = () => unlocked;
const MAX_CACHED_CRIES = 24;
const cryCache = new Map<string, HTMLAudioElement>();
let pingContext: AudioContext | undefined;
const pingOscillators = new Set<OscillatorNode>();

export const cryUrl = (species: string): string | null => {
  const id = species.toLowerCase().replace(/[^a-z0-9]/g, '');
  return id ? `${SPRITE_HOST}/audio/cries/${id}.mp3` : null;
};

export const playCry = (species: string, volume = 0.45): void => {
  if (!unlocked || volume <= 0) return;
  const url = cryUrl(species);
  if (!url) return;
  try {
    let audio = cryCache.get(url);
    if (!audio) {
      audio = new Audio(url);
      if (cryCache.size >= MAX_CACHED_CRIES) {
        const oldest = cryCache.keys().next().value;
        if (oldest) {
          cryCache.get(oldest)?.pause();
          cryCache.delete(oldest);
        }
      }
      cryCache.set(url, audio);
    }
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    // Audio unavailable (jsdom, restrictive embeds): stay silent.
  }
};

/** Two rising notes: "your move". */
export const playTurnPing = (volume = 0.25): void => {
  if (!unlocked || volume <= 0) return;
  try {
    pingContext ??= new AudioContext();
    const ctx = pingContext;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    for (const [at, freq] of [
      [0, 660],
      [0.11, 880],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      pingOscillators.add(osc);
      osc.onended = () => {
        pingOscillators.delete(osc);
        osc.disconnect();
        gain.disconnect();
      };
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + at);
      gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), now + at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + at + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.16);
    }
  } catch {
    // No AudioContext: stay silent.
  }
};

export const stopBattleSounds = () => {
  for (const audio of cryCache.values()) audio.pause();
  for (const oscillator of pingOscillators) {
    try {
      oscillator.stop();
      oscillator.disconnect();
    } catch {
      /* Already stopped. */
    }
  }
  pingOscillators.clear();
  if (pingContext?.state === 'running') void pingContext.suspend().catch(() => {});
};

export const __testables = {
  markUnlocked: () => {
    unlocked = true;
  },
  reset: () => {
    unlocked = false;
    cryCache.clear();
  },
};
