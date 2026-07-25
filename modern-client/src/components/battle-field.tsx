import { motion } from 'motion/react';
import type { ArenaBattle, PokemonSet } from '../compat/battle-adapter';

function Combatant({ hideHealth = false, pokemon, side }: {
  hideHealth?: boolean;
  pokemon: PokemonSet;
  side: 'near' | 'far';
}) {
  return (
    <motion.div
      className={`combatant combatant-${side}`}
      initial={{ opacity: 0, y: side === 'near' ? 24 : -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
    >
      <div className="combatant-sprite" aria-hidden>
        <img
          src={`https://play.pokemonshowdown.com/sprites/gen5${side === 'near' ? '-back' : ''}/${pokemon.species}.png`}
          alt=""
          onError={event => {
            event.currentTarget.style.display = 'none';
          }}
        />
      </div>
      <div className="combatant-bar">
        <div className="combatant-meta">
          <strong>{pokemon.name}</strong>
          <span>{!hideHealth && pokemon.status && <i>{pokemon.status}</i>}{hideHealth ? '—' : `${pokemon.hp}%`}</span>
        </div>
        <div className={`hp-track ${hideHealth ? 'is-hidden' : ''}`} aria-hidden>
          <i style={{ inlineSize: `${Math.max(pokemon.hp, 1)}%` }} data-critical={pokemon.hp < 25} />
        </div>
      </div>
    </motion.div>
  );
}

export function BattleField({ battle, hardcore = false }: { battle: ArenaBattle; hardcore?: boolean }) {
  const nearPlayer = battle.playerSide === 'p2' ? battle.p2 : battle.p1;
  const farPlayer = battle.playerSide === 'p2' ? battle.p1 : battle.p2;

  return (
    <div className="battle-field" aria-label="Battle field" data-weather={battle.weather || 'clear'}>
      <div className="field-backdrop" />
      <div className="field-vignette" />
      <Combatant hideHealth={hardcore} pokemon={battle.opponentActive} side="far" />
      <Combatant pokemon={battle.active} side="near" />
      <div className="field-hud">
        <span>{nearPlayer.name} {nearPlayer.rating > 0 && <i>{nearPlayer.rating}</i>}</span>
        <strong>Turn {battle.turn || '—'}</strong>
        <span>{farPlayer.name} {farPlayer.rating > 0 && <i>{farPlayer.rating}</i>}</span>
      </div>
      <div className="field-rosters" aria-label="Remaining team members">
        <span>
          {battle.team.map(pokemon => <i key={pokemon.slot} data-fainted={pokemon.fainted || pokemon.hp <= 0} title={pokemon.name} />)}
        </span>
        <span>
          {battle.opponentTeam.map(pokemon => <i key={pokemon.slot} data-fainted={!hardcore && (pokemon.fainted || pokemon.hp <= 0)} title={hardcore ? 'Opponent team slot' : pokemon.name} />)}
        </span>
      </div>
      {!hardcore && (battle.weather || battle.fieldConditions?.length) && (
        <div className="field-effects">
          {battle.weather && <span>{battle.weather}</span>}
          {battle.fieldConditions?.map(condition => <span key={condition}>{condition}</span>)}
        </div>
      )}
    </div>
  );
}
