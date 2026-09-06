export function openChallenge(user: string, format?: string, accept = false) {
  window.dispatchEvent(new CustomEvent('arena:challenge', { detail: { user, format, accept } }));
}
