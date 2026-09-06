import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useArenaStore } from '../stores/arena-store';
import { FormatSelector } from '../components/format-selector';
import { battleSupport } from '../compat/battle-adapter';

export function BattlesScreen() {
  const rooms = useArenaStore(state => state.roomList.rooms);
  const formats = useArenaStore(state => state.formats);
  const connection = useArenaStore(state => state.connection);
  const [format, setFormat] = useState('');
  const [query, setQuery] = useState('');
  const [minimum, setMinimum] = useState(0);
  const [sort, setSort] = useState('rating');
  const [page, setPage] = useState(1);
  const [refreshed, setRefreshed] = useState<number>();
  const navigate = useNavigate();
  const refresh = () => { useArenaStore.getState().refreshRoomList(format); setRefreshed(Date.now()); };
  useEffect(() => { if (connection === 'connected') useArenaStore.getState().refreshRoomList(format); }, [connection, format]);
  const matches = rooms.filter(room => (!query || `${room.p1} ${room.p2} ${room.id}`.toLowerCase().includes(query.toLowerCase())) && (!minimum || Number(room.minElo || 0) >= minimum) && battleSupport(room.format || room.id.split('-')[1]).supported).sort((a, b) => sort === 'rating' ? Number(b.minElo || 0) - Number(a.minElo || 0) : (a.p1 || '').localeCompare(b.p1 || ''));
  return <section className="room-directory-surface" aria-label="Battle directory"><header className="stage-heading"><h1>Live battles</h1><Link to="/">Matchmaking</Link></header>
    <div className="directory-tools battle-directory-tools"><label>Format<FormatSelector value={format} formats={[{ id: '', name: 'All formats', team: false }, ...formats.filter(entry => battleSupport(entry.id).supported)]} onValueChange={setFormat} /></label>
      <label>Player or battle<input aria-label="Filter live battles" value={query} onChange={event => { setQuery(event.currentTarget.value); setPage(1); }} /></label>
      <label>Minimum rating<input aria-label="Minimum battle rating" type="number" min={0} max={4000} value={minimum} onChange={event => { setMinimum(Number(event.currentTarget.value)); setPage(1); }} /></label>
      <label>Sort<select aria-label="Sort battles" value={sort} onChange={event => setSort(event.currentTarget.value)}><option value="rating">Rating</option><option value="player">Player</option></select></label>
      <button type="button" className="secondary-action" disabled={connection !== 'connected'} onClick={refresh}>Refresh battles</button>
    </div>
    <p role="status">{connection !== 'connected' ? 'Connect to load live battles.' : `${matches.length} matching battles in the latest server snapshot.`} {refreshed && `Requested at ${new Date(refreshed).toLocaleTimeString()}`}</p>
    <div className="directory-grid">{matches.slice((page - 1) * 40, page * 40).map(room => <button type="button" className="directory-card" key={room.id} onClick={() => { useArenaStore.getState().joinRoom(room.id); void navigate({ to: '/battle/$battleId', params: { battleId: room.id } }); }}><strong>{room.p1} vs {room.p2}</strong><small>{room.format || room.id.split('-')[1]} · Rating {room.minElo || 'unrated'}</small></button>)}</div>
    {!matches.length && connection === 'connected' && <p>No battles match. Change the filters or refresh.</p>}
    <div className="button-row"><button type="button" className="secondary-action" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page}</span><button type="button" className="secondary-action" disabled={page * 40 >= matches.length} onClick={() => setPage(value => value + 1)}>Next</button></div>
  </section>;
}
