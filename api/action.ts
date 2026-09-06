import { proxyForm } from '../server/proxy.js';

export const config = { runtime: 'edge' };

/** Guest assertions and logout only. Registered sign-in goes directly to OAuth. */
export default function handler(request: Request): Promise<Response> {
  return proxyForm(request, {
    upstream: process.env.PS_LOGIN_SERVER || 'https://play.pokemonshowdown.com/action.php',
    requestLimit: 64 * 1024,
    responseLimit: 256 * 1024,
    timeout: 15_000,
    label: 'login',
    validate(form) {
      const action = form.get('act');
      if (action !== 'getassertion' && action !== 'logout') return 'Unsupported login action.';
      const allowed = action === 'getassertion' ? ['act', 'userid', 'challstr'] : ['act', 'userid'];
      if ([...form.keys()].some(key => !allowed.includes(key) || form.getAll(key).length !== 1)) {
        return 'Unsupported or duplicate login field.';
      }
      if (!/^[a-z0-9]{1,18}$/.test(form.get('userid') || '')) return 'Invalid user ID.';
      if (action === 'getassertion') {
        const challenge = form.get('challstr') || '';
        if (!challenge || challenge.length > 4096 || /[\r\n\0]/.test(challenge)) return 'Invalid challenge.';
      }
      return null;
    },
  });
}
