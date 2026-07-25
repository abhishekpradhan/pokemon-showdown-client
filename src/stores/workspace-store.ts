import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkspaceDensity = 'compact' | 'comfortable';
export type WorkspaceMotion = 'full' | 'reduced';
export type WorkspaceContrast = 'standard' | 'high';

type WorkspaceState = {
  density: WorkspaceDensity;
  motion: WorkspaceMotion;
  contrast: WorkspaceContrast;
  notificationsEnabled: boolean;
  setDensity: (density: WorkspaceDensity) => void;
  setMotion: (motion: WorkspaceMotion) => void;
  setContrast: (contrast: WorkspaceContrast) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
};

export const useWorkspaceStore = create<WorkspaceState>()(persist(set => ({
  density: 'compact',
  motion: 'full',
  contrast: 'standard',
  notificationsEnabled: true,
  setDensity: density => set({ density }),
  setMotion: motion => set({ motion }),
  setContrast: contrast => set({ contrast }),
  setNotificationsEnabled: notificationsEnabled => set({ notificationsEnabled }),
}), {
  name: 'ps-arena-workspace-v1',
}));
