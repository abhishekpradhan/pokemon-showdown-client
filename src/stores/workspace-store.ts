import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkspaceTheme = 'light' | 'dark' | 'system';
export type WorkspaceMotion = 'full' | 'reduced';

type WorkspaceState = {
  theme: WorkspaceTheme;
  motion: WorkspaceMotion;
  notificationsEnabled: boolean;
  setTheme: (theme: WorkspaceTheme) => void;
  setMotion: (motion: WorkspaceMotion) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
};

export const useWorkspaceStore = create<WorkspaceState>()(persist(set => ({
  theme: 'system',
  motion: 'full',
  notificationsEnabled: true,
  setTheme: theme => set({ theme }),
  setMotion: motion => set({ motion }),
  setNotificationsEnabled: notificationsEnabled => set({ notificationsEnabled }),
}), {
  name: 'ps-arena-workspace-v1',
}));
