import { proxyForm } from '../server/proxy.js';

export const config = { runtime: 'edge' };

/**
 * Guest assertions only. Registered sign-in goes directly to OAuth, and the
 * socket-level `/logout` ends a session, so no other login-server action is
 * relayed.
 */
export default function handler(request: Request): Promise<Response> {
  return proxyForm(request, {
    upstream: process.env.PS_LOGIN_SERVER || 'https://play.pokemonshowdown.com/action.php',
    requestLimit: 64 * 1024,
    responseLimit: 256 * 1024,
    timeout: 15_000,
    label: 'login',
    validate(form) {
      if (form.get('act') !== 'getassertion') return 'Unsupported login action.';
      const allowed = ['act', 'userid', 'challstr'];
      if ([...form.keys()].some(key => !allowed.includes(key) || form.getAll(key).length !== 1)) {
        return 'Unsupported or duplicate login field.';
      }
      if (!/^[a-z0-9]{1,18}$/.test(form.get('userid') || '')) return 'Invalid user ID.';
      const challenge = form.get('challstr') || '';
      if (!challenge || challenge.length > 4096 || /[\r\n\0]/.test(challenge)) return 'Invalid challenge.';
      return null;
    },
  });
}
