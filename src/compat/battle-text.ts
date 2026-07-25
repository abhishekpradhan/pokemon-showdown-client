import type { BattleLogLine } from './battle-adapter';

/**
 * Turns battle-protocol lines into the human-readable event feed.
 *
 * One wording, used by the live battle log, the replay timeline and the
 * fixtures — this used to exist three times with three phrasings.
 */

const pokemonName = (value = '') => value.split(': ').at(-1) || value;
const speciesName = (value = '') => value.split(',')[0] || value;
const effectName = (value = '') => value.replace(/^(move|ability|item):\s*/i, '');

export function describeBattleLine(line: BattleLogLine): string {
  const { command, args } = line;
  switch (command) {
  case 'turn':
    return `Turn ${args[0]} started.`;
  case 'switch':
  case 'drag':
    return `${pokemonName(args[0])} entered as ${speciesName(args[1])}.`;
  case 'replace':
    return `${pokemonName(args[0])} was revealed as ${speciesName(args[1])}.`;
  case 'move':
    return `${pokemonName(args[0])} used ${args[1]}.`;
  case 'cant':
    return `${pokemonName(args[0])} couldn't move${args[1] ? ` (${effectName(args[1])})` : ''}.`;
  case '-damage':
    return `${pokemonName(args[0])} is at ${(args[1] || '').split(' ')[0]}.`;
  case '-heal':
    return `${pokemonName(args[0])} recovered to ${(args[1] || '').split(' ')[0]}.`;
  case '-status':
    return `${pokemonName(args[0])} was afflicted (${(args[1] || '').toUpperCase()}).`;
  case '-curestatus':
    return `${pokemonName(args[0])} was cured.`;
  case '-boost':
    return `${pokemonName(args[0])} rose (${args[1]} +${args[2]}).`;
  case '-unboost':
    return `${pokemonName(args[0])} fell (${args[1]} -${args[2]}).`;
  case '-supereffective':
    return `It's super effective on ${pokemonName(args[0])}.`;
  case '-resisted':
    return `${pokemonName(args[0])} resisted it.`;
  case '-immune':
    return `${pokemonName(args[0])} is immune.`;
  case '-crit':
    return `A critical hit on ${pokemonName(args[0])}.`;
  case '-miss':
    return `${pokemonName(args[0])}'s attack missed.`;
  case 'faint':
    return `${pokemonName(args[0])} fainted.`;
  case '-terastallize':
    return `${pokemonName(args[0])} terastallized into ${args[1]}.`;
  case '-sidestart':
    return `${effectName(args[1])} settled on ${pokemonName(args[0])}'s side.`;
  case '-sideend':
    return `${effectName(args[1])} faded from ${pokemonName(args[0])}'s side.`;
  case '-weather':
    return !args[0] || args[0] === 'none' ? 'The weather cleared.' : `${effectName(args[0])} began.`;
  case '-fieldstart':
    return `${effectName(args[0])} covered the field.`;
  case '-fieldend':
    return `${effectName(args[0])} ended.`;
  case '-item':
    return `${pokemonName(args[0])} revealed ${args[1]}.`;
  case '-enditem':
    return `${pokemonName(args[0])} lost its ${args[1]}.`;
  case '-ability':
    return `${pokemonName(args[0])}'s ${args[1]} activated.`;
  case 'win':
    return `${args[0]} won the battle.`;
  case 'tie':
    return 'The battle ended in a tie.';
  case 'error':
    return args.join('|');
  default:
    return '';
  }
}
