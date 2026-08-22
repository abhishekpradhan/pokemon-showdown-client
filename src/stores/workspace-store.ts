import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkspaceTheme = 'light' | 'dark' | 'system';

type WorkspaceState = {
  theme: WorkspaceTheme;
  notificationsEnabled: boolean;
  /** Battle audio: cries on switch-in and the your-move ping. */
  soundEnabled: boolean;
  setTheme: (theme: WorkspaceTheme) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
};

export const useWorkspaceStore = create<WorkspaceState>()(persist(set => ({
  theme: 'system',
  notificationsEnabled: true,
  soundEnabled: true,
  setTheme: theme => set({ theme }),
  setNotificationsEnabled: notificationsEnabled => set({ notificationsEnabled }),
  setSoundEnabled: soundEnabled => set({ soundEnabled }),
}), {
  name: 'ps-arena-workspace-v1',
}));
