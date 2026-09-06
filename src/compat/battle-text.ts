export type BattleLogLine = { command: string; args: string[] };

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
  const source = args.find(arg => arg.startsWith('[from] '))?.slice(7);
  const cause = source ? ` (${effectName(source)})` : '';
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
    return `${pokemonName(args[0])} is at ${(args[1] || '').split(' ')[0]}${cause}.`;
  case '-heal':
    return `${pokemonName(args[0])} recovered to ${(args[1] || '').split(' ')[0]}${cause}.`;
  case '-sethp':
    return `${pokemonName(args[0])}'s HP became ${args[1]}${args[2] ? `; ${pokemonName(args[2])}'s HP became ${args[3]}` : ''}${cause}.`;
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
    return !args[0] || args[0] === 'none' ? 'The weather cleared.' : `${effectName(args[0])} ${args.includes('[upkeep]') ? 'continues' : 'began'}${cause}.`;
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
  case '-endability':
    return `${pokemonName(args[0])}'s ability was suppressed${cause}.`;
  case '-start':
  case '-singleturn':
  case '-singlemove':
    return `${pokemonName(args[0])}: ${effectName(args[1])} started${args[2] && !args[2].startsWith('[') ? ` (${pokemonName(args[2])})` : ''}${cause}.`;
  case '-end':
    return `${pokemonName(args[0])}: ${effectName(args[1])} ended${cause}.`;
  case '-activate':
    return `${pokemonName(args[0])}: ${effectName(args[1])} activated${args[2] && !args[2].startsWith('[') ? ` (${pokemonName(args[2])})` : ''}${cause}.`;
  case '-fail':
    return `${pokemonName(args[0])}'s ${args[1] ? effectName(args[1]) : 'action'} failed${cause}.`;
  case '-block':
    return `${pokemonName(args[0])} was protected by ${effectName(args[1])}${cause}.`;
  case '-notarget':
    return 'There was no target for the move.';
  case '-hitcount':
    return `${pokemonName(args[0])} was hit ${args[1]} times.`;
  case '-prepare':
    return `${pokemonName(args[0])} is preparing ${args[1]}.`;
  case '-mustrecharge':
    return `${pokemonName(args[0])} must recharge.`;
  case 'detailschange':
  case '-formechange':
    return `${pokemonName(args[0])} changed into ${speciesName(args[1])}${cause}.`;
  case '-mega':
    return `${pokemonName(args[0])} Mega Evolved${args[2] ? ` using ${args[2]}` : ''}.`;
  case '-primal':
    return `${pokemonName(args[0])} underwent Primal Reversion.`;
  case '-burst':
    return `${pokemonName(args[0])} used Ultra Burst.`;
  case '-zpower':
    return `${pokemonName(args[0])} surrounded itself with Z-Power.`;
  case '-transform':
    return `${pokemonName(args[0])} transformed into ${pokemonName(args[1])}.`;
  case '-clearboost':
    return `${pokemonName(args[0])}'s stat stages were reset.`;
  case '-clearallboost':
    return 'All stat stages were reset.';
  case '-clearpositiveboost':
    return `${pokemonName(args[0])}'s positive stat stages were reset.`;
  case '-clearnegativeboost':
    return `${pokemonName(args[0])}'s negative stat stages were reset.`;
  case '-invertboost':
    return `${pokemonName(args[0])}'s stat stages were inverted.`;
  case '-setboost':
    return `${pokemonName(args[0])}'s ${args[1]} stage became ${args[2]}.`;
  case '-copyboost':
  case '-swapboost':
    return `${pokemonName(args[0])} ${command === '-copyboost' ? 'copied' : 'exchanged'} stat stages with ${pokemonName(args[1])}.`;
  case '-cureteam':
    return `${pokemonName(args[0])}'s team was cured.`;
  case '-fieldactivate':
    return `${effectName(args[0])} activated.`;
  case 'swap':
    return `${pokemonName(args[0])} changed positions.`;
  case '-candynamax':
    return `${args[0]}'s Dynamax is available.`;
  case 'win':
    return `${args[0]} won the battle.`;
  case 'tie':
    return 'The battle ended in a tie.';
  case 'error':
    return args.join('|');
  default:
    // Unknown public battle effects stay visible instead of silently losing
    // mechanic information. Setup, requests, chat and animation-only lines
    // deliberately do not appear in the narrative feed.
    return command.startsWith('-') && !['-anim', '-hint', '-message'].includes(command) ?
      `${command.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2')}: ${args.filter(arg => !arg.startsWith('[')).map(pokemonName).join(' · ')}${cause}.` : '';
  }
}
