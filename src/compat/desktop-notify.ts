/**
 * Desktop notifications for the moments worth interrupting for: |notify| /
 * |tempnotify| from the server, and incoming challenges. Fires only when the
 * page is hidden — a visible app IS the notification — and only with the
 * activity-notifications setting on and browser permission granted.
 */

export const canNotify = (): boolean =>
  typeof Notification !== 'undefined' && Notification.permission === 'granted';

/** Ask once, from a user gesture (the settings toggle). */
export const requestNotifyPermission = async (): Promise<boolean> => {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
};

export const desktopNotify = (title: string, body: string, tag: string, path?: string): void => {
  if (!canNotify() || !document.hidden) return;
  try {
    const notification = new Notification(title, { body, tag, icon: '/icon-512.png' });
    notification.onclick = () => {
      window.focus();
      if (path) window.dispatchEvent(new CustomEvent('arena:open-room', { detail: path }));
      notification.close();
    };
  } catch {
    // Installed mobile browsers require the service worker notification API.
    if ('serviceWorker' in navigator) void navigator.serviceWorker.getRegistration().then(registration => registration?.showNotification(title, { body, tag, icon: '/icon-512.png', data: { path } })).catch(() => {});
  }
};
