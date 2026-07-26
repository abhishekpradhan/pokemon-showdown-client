import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkspaceTheme = 'light' | 'dark' | 'system';

type WorkspaceState = {
  theme: WorkspaceTheme;
  notificationsEnabled: boolean;
  setTheme: (theme: WorkspaceTheme) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
};

export const useWorkspaceStore = create<WorkspaceState>()(persist(set => ({
  theme: 'system',
  notificationsEnabled: true,
  setTheme: theme => set({ theme }),
  setNotificationsEnabled: notificationsEnabled => set({ notificationsEnabled }),
}), {
  name: 'ps-arena-workspace-v1',
}));
