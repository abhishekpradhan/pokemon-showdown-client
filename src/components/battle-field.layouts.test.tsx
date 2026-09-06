import { render } from '@testing-library/react';
import { loadEngine, projectEngineLog } from '../battle/engine';
import { BattleField } from './battle-field';

beforeAll(async () => { await loadEngine(); });

it('animates the identified four-seat owner without animating their partner', () => {
  const battle = projectEngineLog(['|gen|9', '|gametype|multi', '|start',
    '|switch|p1a: Pikachu|Pikachu|100/100', '|switch|p2a: Eevee|Eevee|100/100',
    '|switch|p3b: Charmander|Charmander|100/100', '|switch|p4b: Squirtle|Squirtle|100/100', '|turn|1'])!;
  const { container, rerender } = render(<BattleField battle={battle} lastEvent={{ kind: 'hit', side: 'near', sideId: 'p3', slot: 0, at: 1 }} />);
  expect(container.querySelectorAll('.combatant.is-hit')).toHaveLength(1);
  expect(container.querySelector('.layout-side[data-owner="p3"] .is-hit')).not.toBeNull();
  expect(container.querySelector('.layout-side[data-owner="p1"] .is-hit')).toBeNull();
  rerender(<BattleField battle={battle} lastEvent={{ kind: 'attack', side: 'far', sideId: 'p4', slot: 0, at: 2 }} />);
  expect(container.querySelectorAll('.combatant.is-attack')).toHaveLength(1);
  expect(container.querySelector('.layout-side[data-owner="p4"] .is-attack')).not.toBeNull();
});
