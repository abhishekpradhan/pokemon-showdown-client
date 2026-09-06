import { useEffect } from 'react';
import { useWorkspaceStore } from '../stores/workspace-store';
import { readBackground, validateBackground } from './background';

export function useBackground() {
  const background = useWorkspaceStore(state => state.background);
  useEffect(() => {
    let disposed = false;
    let objectUrl: string | undefined;
    let revision = 0;
    const apply = async () => {
      const current = ++revision;
      document.documentElement.dataset.background = background;
      document.documentElement.style.removeProperty('--arena-background-image');
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = undefined;
      if (background !== 'custom') return;
      try {
        const blob = await readBackground();
        if (disposed || current !== revision) return;
        if (!blob) return;
        validateBackground(blob);
        objectUrl = URL.createObjectURL(blob);
        document.documentElement.style.setProperty('--arena-background-image', `url("${objectUrl}")`);
      } catch { /* The default background remains readable if storage is unavailable. */ }
    };
    void apply();
    const changed = () => { void apply(); };
    window.addEventListener('arena:background-changed', changed);
    return () => {
      disposed = true;
      window.removeEventListener('arena:background-changed', changed);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      document.documentElement.style.removeProperty('--arena-background-image');
      delete document.documentElement.dataset.background;
    };
  }, [background]);
}
