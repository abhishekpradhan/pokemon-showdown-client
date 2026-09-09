import { vi } from 'vitest';
import { canNotify, desktopNotify, requestNotifyPermission } from './desktop-notify';

const stubNotification = (
  permission: NotificationPermission,
  requestResult: NotificationPermission = 'granted',
) => {
  const instances: Array<{ title: string; options?: NotificationOptions }> = [];
  const NotificationMock = vi.fn(function (
    this: { onclick: null },
    title: string,
    options?: NotificationOptions,
  ) {
    instances.push({ title, options });
    this.onclick = null;
    return this;
  }) as unknown as typeof Notification & { instances: typeof instances };
  Object.defineProperty(NotificationMock, 'permission', { value: permission, configurable: true });
  (
    NotificationMock as unknown as { requestPermission: () => Promise<NotificationPermission> }
  ).requestPermission = vi.fn().mockResolvedValue(requestResult);
  (NotificationMock as { instances: typeof instances }).instances = instances;
  vi.stubGlobal('Notification', NotificationMock);
  return NotificationMock;
};

describe('desktop notifications', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fires only when hidden with permission granted', () => {
    const mock = stubNotification('granted');
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    desktopNotify('Title', 'body', 'tag');
    expect(mock.instances).toHaveLength(0);

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    desktopNotify('Zarel challenged you', 'gen9ou', 'challenge-zarel');
    expect(mock.instances).toEqual([
      {
        title: 'Zarel challenged you',
        options: { body: 'gen9ou', tag: 'challenge-zarel', icon: '/icon-512.png' },
      },
    ]);
  });

  it('never fires without permission, and requests it politely', async () => {
    const mock = stubNotification('default');
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    desktopNotify('Title', 'body', 'tag');
    expect(mock.instances).toHaveLength(0);
    expect(canNotify()).toBe(false);

    await expect(requestNotifyPermission()).resolves.toBe(true);

    stubNotification('denied');
    await expect(requestNotifyPermission()).resolves.toBe(false);
  });
});
