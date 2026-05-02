import { motion } from 'motion/react';
import type { ArenaBattle, PokemonSet } from '../compat/battle-adapter';

function Combatant({ pokemon, side }: { pokemon: PokemonSet; side: 'near' | 'far' }) {
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
        <strong>{pokemon.name}</strong>
        <span>{pokemon.hp}%</span>
        <div className="hp-track" aria-hidden>
          <i style={{ inlineSize: `${Math.max(pokemon.hp, 1)}%` }} data-critical={pokemon.hp < 25} />
        </div>
      </div>
    </motion.div>
  );
}

export function BattleField({ battle }: { battle: ArenaBattle }) {
  return (
    <div className="battle-field" aria-label="Battle field">
      <div className="field-backdrop" />
      <Combatant pokemon={battle.opponentActive} side="far" />
      <Combatant pokemon={battle.active} side="near" />
      <div className="field-hud">
        <span>{battle.p1.rating}</span>
        <strong>Turn {battle.turn}</strong>
        <span>{battle.p2.rating}</span>
      </div>
    </div>
  );
}
