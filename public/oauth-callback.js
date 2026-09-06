/* Only the opener validates this grant against its popup, path and per-attempt state. */
(() => {
  const search = location.search;
  const params = new URLSearchParams(search);
  // Same-origin polling fallback. The opener clears this before closing us.
  window.name = `ps-oauth:${search}`;
  history.replaceState(null, '', location.pathname);
  const status = document.getElementById('status');
  if (status) status.textContent = params.get('assertion') && params.get('token') ?
    'Finishing sign-in in the original window. You can close this window if it has finished.' :
    'Sign-in was cancelled or failed. You can close this window.';
  try {
    window.opener?.postMessage({ type: 'ps-oauth', search }, location.origin);
  } catch { /* The opener also polls this same-origin callback. */ }
})();
