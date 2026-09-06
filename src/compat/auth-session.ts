/** One cancellable identity operation per application session. */
let active: AbortController | undefined;
let requestedIdentity: string | undefined;
const identity = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export function cancelAuthentication() {
  active?.abort();
  active = undefined;
  requestedIdentity = undefined;
}

/** Arm only when /trn is about to be sent, never while a provider/fetch is pending. */
export function expectAuthenticationIdentity(name: string) {
  if (active && !active.signal.aborted) requestedIdentity = identity(name) || undefined;
}

/** Older servers omit the target name on assertion errors, but not success ACKs. */
export function matchesAuthenticationIdentity(name: string, allowUnnamed = false) {
  const userid = identity(name);
  return !!active && !active.signal.aborted && !!requestedIdentity &&
    (userid === requestedIdentity || (allowUnnamed && !userid));
}

export function beginAuthentication() {
  cancelAuthentication();
  const controller = new AbortController();
  active = controller;
  return {
    signal: controller.signal,
    current: () => active === controller && !controller.signal.aborted,
  };
}
