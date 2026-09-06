import { proxyForm } from '../server/proxy';

export const config = { runtime: 'edge' };

/** Legacy queryresponse|savereplay uploads use the login server's uploadreplay
 * action. Modern servers upload directly and send an authoritative popup URL. */
export default function handler(request: Request): Promise<Response> {
  return proxyForm(request, {
    upstream: process.env.PS_LOGIN_SERVER || 'https://play.pokemonshowdown.com/action.php',
    requestLimit: 4 * 1024 * 1024,
    responseLimit: 128 * 1024,
    timeout: 20_000,
    label: 'replay',
    validate(form) {
      if ([...form.keys()].some(key => !['act', 'serverid', 'id', 'log', 'password'].includes(key) || form.getAll(key).length !== 1)) {
        return 'Unsupported or duplicate replay field.';
      }
      if (!/^[a-z0-9-]{1,200}$/.test(form.get('id') || '')) return 'Invalid replay ID.';
      if (form.get('act') && form.get('act') !== 'uploadreplay') return 'Unsupported replay action.';
      if (!/^[a-z0-9]{1,80}$/.test(form.get('serverid') || '')) return 'Invalid replay server ID.';
      if (!form.get('log')) return 'Missing replay log.';
      if ((form.get('password') || '').length > 256) return 'Invalid replay password.';
      form.set('act', 'uploadreplay');
      return null;
    },
  });
}
