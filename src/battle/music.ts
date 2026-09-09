import { SPRITE_HOST } from '../data/sprites';
import { clampVolume, type MusicTrack } from '../preferences/options';

// Loop points match battle-animations.ts in upstream client ac7d535b (MIT).
const LOOPS: Record<MusicTrack, [number, number]> = {
  'bw-trainer': [14.629, 110.109],
  'dpp-trainer': [13.44, 96.959],
  'xy-trainer': [7.802, 82.469],
};
/** One media element for the focused battle; never one per room or per render. */
export class BattleMusic {
  private audio?: HTMLAudioElement;
  private track?: MusicTrack;
  private playing = false;
  sync(enabled: boolean, track: MusicTrack, volume: number) {
    if (!enabled || volume <= 0) {
      this.pause();
      return;
    }
    if (track !== this.track) this.dispose();
    try {
      if (!this.audio) {
        this.audio = new Audio(`${SPRITE_HOST}/audio/${track}.mp3`);
        this.audio.preload = 'none';
        this.audio.loop = true;
        this.track = track;
        this.audio.addEventListener('timeupdate', () => {
          const [start, end] = LOOPS[track];
          if (this.audio && this.audio.currentTime >= end) this.audio.currentTime = start;
        });
      }
      this.audio.volume = clampVolume(volume) / 100;
      if (this.playing) return;
      this.playing = true;
      const current = this.audio;
      void current.play().catch(() => {
        if (this.audio === current) this.playing = false;
      });
    } catch {
      this.playing = false;
    }
  }
  pause() {
    this.audio?.pause();
    this.playing = false;
  }
  dispose() {
    this.pause();
    if (this.audio) {
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    this.audio = undefined;
    this.track = undefined;
  }
}
