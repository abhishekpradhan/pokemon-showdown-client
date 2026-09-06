import { beginAuthentication, cancelAuthentication } from './auth-session';

it('invalidates unfinished identity operations on replacement and logout', () => {
  const popup = beginAuthentication();
  const reconnect = beginAuthentication();
  expect(popup.signal.aborted).toBe(true);
  expect(popup.current()).toBe(false);
  expect(reconnect.current()).toBe(true);
  cancelAuthentication();
  expect(reconnect.current()).toBe(false);
  expect(reconnect.signal.aborted).toBe(true);
});
