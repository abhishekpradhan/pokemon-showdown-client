import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useArenaStore } from '../stores/arena-store';
import { FormatSelector } from './format-selector';
import { battleSupport } from '../compat/battle-adapter';

export function ChallengeDialog() {
  const [request, setRequest] = useState<{ user: string; format?: string; accept: boolean }>();
  const [format, setFormat] = useState('');
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState('');
  const formats = useArenaStore(state => state.formats);
  const teams = useArenaStore(state => state.teams);
  useEffect(() => {
    const open = (event: Event) => {
      const next = (event as CustomEvent<{ user: string; format?: string; accept: boolean }>).detail;
      setRequest(next); setFormat(next.format || useArenaStore.getState().selectedFormat); setTeamId(useArenaStore.getState().activeTeamId || ''); setError('');
    };
    window.addEventListener('arena:challenge', open);
    return () => window.removeEventListener('arena:challenge', open);
  }, []);
  const entry = formats.find(item => item.id === format);
  return <Dialog.Root open={!!request} onOpenChange={open => { if (!open) setRequest(undefined); }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="account-dialog">
    <div className="dialog-heading"><div><Dialog.Title>{request?.accept ? 'Accept challenge' : 'Challenge'} · {request?.user}</Dialog.Title><Dialog.Description>Choose the format and team for this match.</Dialog.Description></div><Dialog.Close className="icon-button" aria-label="Close challenge"><X size={17} /></Dialog.Close></div>
    <div className="account-form"><label><span>Format</span>{request?.accept ? <strong>{entry?.name || format}</strong> : <FormatSelector value={format} formats={formats.filter(item => item.challengeShow !== false && battleSupport(item.id).supported)} onValueChange={setFormat} />}</label>
      {entry?.team !== false && <label><span>Team</span><select aria-label="Challenge team" value={teamId} onChange={event => setTeamId(event.currentTarget.value)}><option value="">Choose team</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name} · {team.format}</option>)}</select></label>}
      {error && <p role="alert">{error}</p>}
      <button type="button" className="primary-action" onClick={() => {
        if (!request) return;
        const state = useArenaStore.getState();
        if (entry?.team !== false) {
          const validation = state.validateTeamForFormat(teamId, format);
          if (!teamId || !validation.ok) { setError(validation.errors.join(' ') || 'Choose a team.'); return; }
          state.selectTeam(teamId);
        }
        useArenaStore.setState({ lastError: undefined });
        if (request.accept) state.acceptChallenge(request.user); else state.sendChallenge(request.user, format);
        const failure = useArenaStore.getState().lastError;
        if (failure) setError(failure); else setRequest(undefined);
      }}>{request?.accept ? 'Accept challenge' : 'Send challenge'}</button>
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
