import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '../stores/workspace-store';
import { BattleMusic } from './music';
import { isAudioUnlocked, stopBattleSounds } from './sound';

const music = new BattleMusic();
export function useBattleAudio(active: boolean) {
  const preferences = useWorkspaceStore(
    useShallow(({ soundEnabled, musicEnabled, musicTrack, musicVolume }) => ({
      soundEnabled,
      musicEnabled,
      musicTrack,
      musicVolume,
    })),
  );
  useEffect(() => {
    const sync = () => {
      const visible = active && !document.hidden;
      if (!visible || !preferences.soundEnabled) stopBattleSounds();
      music.sync(
        visible && preferences.soundEnabled && preferences.musicEnabled && isAudioUnlocked(),
        preferences.musicTrack,
        preferences.musicVolume,
      );
    };
    sync();
    window.addEventListener('pointerdown', sync);
    window.addEventListener('keydown', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('pointerdown', sync);
      window.removeEventListener('keydown', sync);
      document.removeEventListener('visibilitychange', sync);
      music.pause();
    };
  }, [active, preferences]);
  useEffect(() => () => music.dispose(), []);
}
