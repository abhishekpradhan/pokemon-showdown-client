/** One cancellable identity operation per application session. */
let active: AbortController | undefined;

export function cancelAuthentication() {
  active?.abort();
  active = undefined;
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
