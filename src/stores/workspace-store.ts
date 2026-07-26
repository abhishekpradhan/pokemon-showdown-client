import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkspaceTheme = 'light' | 'dark' | 'system';
export type WorkspaceMotion = 'full' | 'reduced';
export type WorkspaceContrast = 'standard' | 'high';

type WorkspaceState = {
  theme: WorkspaceTheme;
  motion: WorkspaceMotion;
  contrast: WorkspaceContrast;
  notificationsEnabled: boolean;
  setTheme: (theme: WorkspaceTheme) => void;
  setMotion: (motion: WorkspaceMotion) => void;
  setContrast: (contrast: WorkspaceContrast) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
};

export const useWorkspaceStore = create<WorkspaceState>()(persist(set => ({
  theme: 'system',
  motion: 'full',
  contrast: 'standard',
  notificationsEnabled: true,
  setTheme: theme => set({ theme }),
  setMotion: motion => set({ motion }),
  setContrast: contrast => set({ contrast }),
  setNotificationsEnabled: notificationsEnabled => set({ notificationsEnabled }),
}), {
  name: 'ps-arena-workspace-v1',
}));
