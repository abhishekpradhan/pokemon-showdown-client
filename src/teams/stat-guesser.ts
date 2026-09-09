/**
 * Pokémon Showdown BattleStatGuesser, adapted to Arena's typed set/dex boundary.
 * Source: smogon/pokemon-showdown-client, ac7d535b, battle-tooltips.ts:3006–3630.
 * Algorithm retained; dependency injection and types replace browser globals.
 * Copyright (c) Guangcong Luo and Pokémon Showdown contributors.
 * Original file author: Guangcong Luo <guangcongluo@gmail.com>; license: MIT.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import type { ModdedDex, StatID, StatsTable } from '@pkmn/dex';
import type { TeamSet } from '../compat/team-store';
import { toId } from '../compat/protocol-parsers';
type BoostStat = Exclude<StatID, 'hp'>;

export class BattleStatGuesser {
  formatid: string;
  dex: ModdedDex;
  moveCount: Record<string, number> = {};
  hasMove: Record<string, number> = {};

  ignoreEVLimits: boolean;
  useStatPoints: boolean;
  supportsEVs: boolean;
  supportsAVs: boolean;

  constructor(formatid: string, dex: ModdedDex) {
    this.formatid = formatid;
    this.dex = dex;
    this.ignoreEVLimits =
      this.dex.gen < 3 ||
      ((this.formatid.endsWith('hackmons') || this.formatid.endsWith('bh')) && this.dex.gen !== 6) ||
      this.formatid.includes('metronomebattle') ||
      this.formatid.endsWith('norestrictions');
    this.useStatPoints = this.formatid.includes('champions');
    this.supportsEVs = !this.formatid.includes('letsgo') && !this.useStatPoints;
    this.supportsAVs = !this.supportsEVs && this.formatid.endsWith('norestrictions');
  }
  guess(set: TeamSet) {
    const role = this.guessRole(set);
    const comboEVs = this.guessEVs(set, role);
    const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    for (const stat in evs) {
      evs[stat as StatID] = comboEVs[stat as StatID] || 0;
    }
    const plusStat = comboEVs.plusStat || ('' as const);
    const minusStat = comboEVs.minusStat || ('' as const);
    return { role, evs, plusStat, minusStat, moveCount: this.moveCount, hasMove: this.hasMove };
  }
  guessRole(set: TeamSet) {
    if (!set) return '?';
    if (!set.moves) return '?';

    const moveCount = {
      Physical: 0,
      Special: 0,
      PhysicalAttack: 0,
      SpecialAttack: 0,
      PhysicalSetup: 0,
      SpecialSetup: 0,
      Support: 0,
      Setup: 0,
      Restoration: 0,
      Offense: 0,
      Stall: 0,
      SpecialStall: 0,
      PhysicalStall: 0,
      Fast: 0,
      Ultrafast: 0,
      bulk: 0,
      specialBulk: 0,
      physicalBulk: 0,
    };
    const hasMove: { [moveid: string]: 1 } = {};
    const itemid = toId(set.item || '');
    const item = this.dex.items.get(itemid);
    const abilityid = toId(set.ability || '');

    let species = this.dex.species.get(set.species || set.name!);
    if (item.megaStone?.[species.name]) species = this.dex.species.get(item.megaStone[species.name]);
    if (!species.exists) return '?';
    const stats = species.baseStats;

    if (set.moves.length < 1) return '?';
    let needsFourMoves = !['Unown', 'Ditto'].includes(species.baseSpecies);
    const hasFourValidMoves = set.moves.length >= 4 && !set.moves.includes('');
    const moveids = set.moves.map(toId);
    if (moveids.includes('lastresort')) needsFourMoves = false;
    if (!hasFourValidMoves && needsFourMoves && !this.formatid.includes('metronomebattle')) {
      return '?';
    }

    for (let i = 0, len = set.moves.length; i < len; i++) {
      const move = this.dex.moves.get(set.moves[i]);
      if (!move.exists) continue;
      hasMove[move.id] = 1;
      if (move.category === 'Status') {
        if (['batonpass', 'healingwish', 'lunardance'].includes(move.id)) {
          moveCount['Support']++;
        } else if (
          ['metronome', 'assist', 'copycat', 'mefirst', 'photongeyser', 'shellsidearm'].includes(move.id)
        ) {
          moveCount['Physical'] += 0.5;
          moveCount['Special'] += 0.5;
        } else if (move.id === 'naturepower') {
          moveCount['Special']++;
        } else if (['protect', 'detect', 'spikyshield', 'kingsshield'].includes(move.id)) {
          moveCount['Stall']++;
        } else if (move.id === 'wish') {
          moveCount['Restoration']++;
          moveCount['Stall']++;
          moveCount['Support']++;
        } else if (move.heal) {
          moveCount['Restoration']++;
          moveCount['Stall']++;
        } else if (move.target === 'self') {
          if (['agility', 'rockpolish', 'shellsmash', 'growth', 'workup'].includes(move.id)) {
            moveCount['PhysicalSetup']++;
            moveCount['SpecialSetup']++;
          } else if (
            ['dragondance', 'swordsdance', 'coil', 'bulkup', 'curse', 'bellydrum'].includes(move.id)
          ) {
            moveCount['PhysicalSetup']++;
          } else if (['nastyplot', 'tailglow', 'quiverdance', 'calmmind', 'geomancy'].includes(move.id)) {
            moveCount['SpecialSetup']++;
          }
          if (move.id === 'substitute') moveCount['Stall']++;
          moveCount['Setup']++;
        } else {
          if (['toxic', 'leechseed', 'willowisp'].includes(move.id)) {
            moveCount['Stall']++;
          }
          moveCount['Support']++;
        }
      } else if (['counter', 'endeavor', 'metalburst', 'mirrorcoat', 'rapidspin'].includes(move.id)) {
        moveCount['Support']++;
      } else if (
        [
          'nightshade',
          'seismictoss',
          'psywave',
          'superfang',
          'naturesmadness',
          'foulplay',
          'endeavor',
          'finalgambit',
          'bodypress',
        ].includes(move.id)
      ) {
        moveCount['Offense']++;
      } else if (move.id === 'fellstinger') {
        moveCount['PhysicalSetup']++;
        moveCount['Setup']++;
      } else {
        moveCount[move.category]++;
        moveCount['Offense']++;
        if (move.id === 'knockoff') {
          moveCount['Support']++;
        }
        if (['scald', 'voltswitch', 'uturn', 'flipturn'].includes(move.id)) {
          moveCount[move.category] -= 0.2;
        }
      }
    }
    if (hasMove['batonpass']) moveCount['Support'] += moveCount['Setup'];
    moveCount['PhysicalAttack'] = moveCount['Physical'];
    moveCount['Physical'] += moveCount['PhysicalSetup'];
    moveCount['SpecialAttack'] = moveCount['Special'];
    moveCount['Special'] += moveCount['SpecialSetup'];

    if (hasMove['dragondance'] || hasMove['quiverdance']) moveCount['Ultrafast'] = 1;

    let isFast = stats.spe >= 80;
    let physicalBulk = (stats.hp + 75) * (stats.def + 87);
    let specialBulk = (stats.hp + 75) * (stats.spd + 87);

    if (hasMove['willowisp'] || hasMove['acidarmor'] || hasMove['irondefense'] || hasMove['cottonguard']) {
      physicalBulk *= 1.6;
      moveCount['PhysicalStall']++;
    } else if (hasMove['scald'] || hasMove['bulkup'] || hasMove['coil'] || hasMove['cosmicpower']) {
      physicalBulk *= 1.3;
      if (hasMove['scald']) {
        // partial stall goes in reverse
        moveCount['SpecialStall']++;
      } else {
        moveCount['PhysicalStall']++;
      }
    }
    if (abilityid === 'flamebody') physicalBulk *= 1.1;

    if (hasMove['calmmind'] || hasMove['quiverdance'] || hasMove['geomancy']) {
      specialBulk *= 1.3;
      moveCount['SpecialStall']++;
    }
    if (abilityid === 'sandstream' && species.types.includes('Rock')) {
      specialBulk *= 1.5;
    }

    if (hasMove['bellydrum']) {
      physicalBulk *= 0.6;
      specialBulk *= 0.6;
    }
    if (moveCount['Restoration']) {
      physicalBulk *= 1.5;
      specialBulk *= 1.5;
    } else if (hasMove['painsplit'] && hasMove['substitute']) {
      // SubSplit isn't generally a stall set
      moveCount['Stall']--;
    } else if (hasMove['painsplit'] || hasMove['rest']) {
      physicalBulk *= 1.4;
      specialBulk *= 1.4;
    }
    if (
      ((hasMove['bodyslam'] || hasMove['thunder']) && abilityid === 'serenegrace') ||
      hasMove['thunderwave']
    ) {
      physicalBulk *= 1.1;
      specialBulk *= 1.1;
    }
    if ((hasMove['ironhead'] || hasMove['airslash']) && abilityid === 'serenegrace') {
      physicalBulk *= 1.1;
      specialBulk *= 1.1;
    }
    if (hasMove['gigadrain'] || hasMove['drainpunch'] || hasMove['hornleech']) {
      physicalBulk *= 1.15;
      specialBulk *= 1.15;
    }
    if (itemid === 'leftovers' || itemid === 'blacksludge') {
      physicalBulk *= 1 + 0.1 * (1 + moveCount['Stall'] / 1.5);
      specialBulk *= 1 + 0.1 * (1 + moveCount['Stall'] / 1.5);
    }
    if (hasMove['leechseed']) {
      physicalBulk *= 1 + 0.1 * (1 + moveCount['Stall'] / 1.5);
      specialBulk *= 1 + 0.1 * (1 + moveCount['Stall'] / 1.5);
    }
    if ((itemid === 'flameorb' || itemid === 'toxicorb') && abilityid !== 'magicguard') {
      if (itemid === 'toxicorb' && abilityid === 'poisonheal') {
        physicalBulk *= 1 + 0.1 * (2 + moveCount['Stall']);
        specialBulk *= 1 + 0.1 * (2 + moveCount['Stall']);
      } else {
        physicalBulk *= 0.8;
        specialBulk *= 0.8;
      }
    }
    if (itemid === 'lifeorb') {
      physicalBulk *= 0.7;
      specialBulk *= 0.7;
    }
    if (abilityid === 'multiscale' || abilityid === 'magicguard' || abilityid === 'regenerator') {
      physicalBulk *= 1.4;
      specialBulk *= 1.4;
    }
    if (itemid === 'eviolite') {
      physicalBulk *= 1.5;
      specialBulk *= 1.5;
    }
    if (itemid === 'assaultvest') {
      specialBulk *= 1.5;
    }

    const bulk = physicalBulk + specialBulk;
    if (bulk < 46000 && stats.spe >= 70) isFast = true;
    if (hasMove['trickroom']) isFast = false;
    moveCount['bulk'] = bulk;
    moveCount['physicalBulk'] = physicalBulk;
    moveCount['specialBulk'] = specialBulk;

    if (
      hasMove['agility'] ||
      hasMove['dragondance'] ||
      hasMove['quiverdance'] ||
      hasMove['rockpolish'] ||
      hasMove['shellsmash'] ||
      hasMove['flamecharge']
    ) {
      isFast = true;
    } else if (abilityid === 'unburden' || abilityid === 'speedboost' || abilityid === 'motordrive') {
      isFast = true;
      moveCount['Ultrafast'] = 1;
    } else if (abilityid === 'chlorophyll' || abilityid === 'swiftswim' || abilityid === 'sandrush') {
      isFast = true;
      moveCount['Ultrafast'] = 2;
    } else if (itemid === 'salacberry') {
      isFast = true;
    }
    const ultrafast =
      hasMove['agility'] ||
      hasMove['shellsmash'] ||
      hasMove['autotomize'] ||
      hasMove['shiftgear'] ||
      hasMove['rockpolish'];
    if (ultrafast) {
      moveCount['Ultrafast'] = 2;
    }
    moveCount['Fast'] = isFast ? 1 : 0;

    this.moveCount = moveCount;
    this.hasMove = hasMove;

    if (species.id === 'ditto')
      return abilityid === 'imposter' ? 'Physically Defensive' : 'Fast Bulky Support';
    if (species.id === 'shedinja') return 'Fast Physical Sweeper';

    if (itemid === 'choiceband' && moveCount['PhysicalAttack'] >= 2) {
      if (!isFast) return 'Bulky Band';
      return 'Fast Band';
    } else if (itemid === 'choicespecs' && moveCount['SpecialAttack'] >= 2) {
      if (!isFast) return 'Bulky Specs';
      return 'Fast Specs';
    } else if (itemid === 'choicescarf') {
      if (moveCount['PhysicalAttack'] === 0) return 'Special Scarf';
      if (moveCount['SpecialAttack'] === 0) return 'Physical Scarf';
      if (moveCount['PhysicalAttack'] > moveCount['SpecialAttack']) return 'Physical Biased Mixed Scarf';
      if (moveCount['PhysicalAttack'] < moveCount['SpecialAttack']) return 'Special Biased Mixed Scarf';
      if (stats.atk < stats.spa) return 'Special Biased Mixed Scarf';
      return 'Physical Biased Mixed Scarf';
    }

    if (species.id === 'unown') return 'Fast Special Sweeper';

    if (moveCount['PhysicalStall'] && moveCount['Restoration']) {
      if (stats.spe > 110 && abilityid !== 'prankster') return 'Fast Bulky Support';
      return 'Specially Defensive';
    }
    if (moveCount['SpecialStall'] && moveCount['Restoration'] && itemid !== 'lifeorb') {
      if (stats.spe > 110 && abilityid !== 'prankster') return 'Fast Bulky Support';
      return 'Physically Defensive';
    }

    let offenseBias: 'Physical' | 'Special' = 'Physical';
    if (stats.spa > stats.atk && moveCount['Special'] > 1) offenseBias = 'Special';
    else if (stats.atk > stats.spa && moveCount['Physical'] > 1) offenseBias = 'Physical';
    else if (moveCount['Special'] > moveCount['Physical']) offenseBias = 'Special';

    if (
      moveCount['Stall'] + moveCount['Support'] / 2 <= 2 &&
      bulk < 135000 &&
      moveCount[offenseBias] >= 1.5
    ) {
      if (isFast) {
        if (bulk > 80000 && !moveCount['Ultrafast']) return 'Bulky ' + offenseBias + ' Sweeper';
        return 'Fast ' + offenseBias + ' Sweeper';
      } else {
        if (moveCount[offenseBias] >= 3 || moveCount['Stall'] <= 0) {
          return 'Bulky ' + offenseBias + ' Sweeper';
        }
      }
    }

    if (isFast && abilityid !== 'prankster') {
      if (stats.spe > 100 || bulk < 55000 || moveCount['Ultrafast']) {
        return 'Fast Bulky Support';
      }
    }
    if (moveCount['SpecialStall']) return 'Physically Defensive';
    if (moveCount['PhysicalStall']) return 'Specially Defensive';
    if (species.id === 'blissey' || species.id === 'chansey') return 'Physically Defensive';
    if (specialBulk >= physicalBulk) return 'Specially Defensive';
    return 'Physically Defensive';
  }
  ensureMinEVs(evs: StatsTable, stat: StatID, min: number, evTotal: number) {
    if (!evs[stat]) evs[stat] = 0;
    let diff = min - evs[stat];
    if (diff <= 0) return evTotal;
    if (evTotal <= 504) {
      const change = Math.min(508 - evTotal, diff);
      evTotal += change;
      evs[stat] += change;
      diff -= change;
    }
    if (diff <= 0) return evTotal;
    const evPriority = { def: 1, spd: 1, hp: 1, atk: 1, spa: 1, spe: 1 };
    let prioStat: StatID;
    for (prioStat in evPriority) {
      if (prioStat === stat) continue;
      if (evs[prioStat] && evs[prioStat] > 128) {
        evs[prioStat] -= diff;
        evs[stat] += diff;
        return evTotal;
      }
    }
    return evTotal; // can't do it :(
  }
  ensureMaxEVs(evs: StatsTable, stat: StatID, min: number, evTotal: number) {
    if (!evs[stat]) evs[stat] = 0;
    const diff = evs[stat] - min;
    if (diff <= 0) return evTotal;
    evs[stat] -= diff;
    evTotal -= diff;
    return evTotal; // can't do it :(
  }
  guessEVs(
    set: TeamSet,
    role: string,
  ): Partial<StatsTable> & { plusStat?: BoostStat; minusStat?: BoostStat } {
    if (!set) return {};
    if (role === '?') return {};
    const species = this.dex.species.get(set.species || set.name!);
    const stats = species.baseStats;

    const hasMove = this.hasMove;
    const moveCount = this.moveCount;

    let evs: StatsTable & { plusStat?: BoostStat; minusStat?: BoostStat } = {
      hp: 0,
      atk: 0,
      def: 0,
      spa: 0,
      spd: 0,
      spe: 0,
    };
    let plusStat: BoostStat;
    let minusStat: BoostStat | undefined = undefined;

    const statChart: { [role: string]: [BoostStat, StatID] } = {
      'Bulky Band': ['atk', 'hp'],
      'Fast Band': ['spe', 'atk'],
      'Bulky Specs': ['spa', 'hp'],
      'Fast Specs': ['spe', 'spa'],
      'Physical Scarf': ['spe', 'atk'],
      'Special Scarf': ['spe', 'spa'],
      'Physical Biased Mixed Scarf': ['spe', 'atk'],
      'Special Biased Mixed Scarf': ['spe', 'spa'],
      'Fast Physical Sweeper': ['spe', 'atk'],
      'Fast Special Sweeper': ['spe', 'spa'],
      'Bulky Physical Sweeper': ['atk', 'hp'],
      'Bulky Special Sweeper': ['spa', 'hp'],
      'Fast Bulky Support': ['spe', 'hp'],
      'Physically Defensive': ['def', 'hp'],
      'Specially Defensive': ['spd', 'hp'],
    };

    plusStat = statChart[role][0];
    if (role === 'Fast Bulky Support') moveCount['Ultrafast'] = 0;
    if (plusStat === 'spe' && moveCount['Ultrafast']) {
      if (statChart[role][1] === 'atk' || statChart[role][1] === 'spa') {
        plusStat = statChart[role][1];
      } else if (moveCount['Physical'] >= 3) {
        plusStat = 'atk';
      } else if (stats.spd > stats.def) {
        plusStat = 'spd';
      } else {
        plusStat = 'def';
      }
    }

    if (this.supportsAVs) {
      // Let's Go, AVs enabled
      evs = { hp: 200, atk: 200, def: 200, spa: 200, spd: 200, spe: 200 };
      if (!moveCount['PhysicalAttack']) evs.atk = 0;
      if (!moveCount['SpecialAttack']) evs.spa = 0;
      if (hasMove['gyroball'] || hasMove['trickroom']) evs.spe = 0;
    } else if (!this.supportsEVs && !this.useStatPoints) {
      // Let's Go, AVs disabled
      // no change
    } else if (this.ignoreEVLimits) {
      // Gen 1-2, hackable EVs (like Hackmons)
      evs = { hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 };
      if (!moveCount['PhysicalAttack']) evs.atk = 0;
      if (!moveCount['SpecialAttack'] && this.dex.gen > 1) evs.spa = 0;
      if (hasMove['gyroball'] || hasMove['trickroom']) evs.spe = 0;
      if (this.dex.gen === 1) evs.spd = 0;
      if (this.dex.gen < 3) return evs;
    } else {
      // Normal Gen 3-7
      if (!statChart[role]) return {};

      let evTotal = 0;

      const maxPoints = !this.useStatPoints ? 252 : 32;
      const totalPoints = !this.useStatPoints ? 508 : 66;
      const primaryStat = statChart[role][0];
      let stat = this.getStat(primaryStat, set, maxPoints, plusStat === primaryStat ? 1.1 : 1.0);
      let ev = !this.useStatPoints ? 252 : 32;
      const step = !this.useStatPoints ? 4 : 1;
      while (
        ev > 0 &&
        stat <= this.getStat(primaryStat, set, ev - step, plusStat === primaryStat ? 1.1 : 1.0)
      )
        ev -= step;

      evs[primaryStat] = ev;
      evTotal += ev;

      let secondaryStat: StatID | null = statChart[role][1];
      if (secondaryStat === 'hp' && set.level && set.level < 20) secondaryStat = 'spd';
      stat = this.getStat(secondaryStat, set, maxPoints, plusStat === secondaryStat ? 1.1 : 1.0);
      ev = !this.useStatPoints ? 252 : 32;
      while (
        ev > 0 &&
        stat <= this.getStat(secondaryStat, set, ev - step, plusStat === secondaryStat ? 1.1 : 1.0)
      ) {
        ev -= step;
      }
      evs[secondaryStat] = ev;
      evTotal += ev;

      if (this.supportsEVs) {
        if (species.id === 'tentacruel') {
          evTotal = this.ensureMinEVs(evs, 'spe', 16, evTotal);
        } else if (species.id === 'skarmory') {
          evTotal = this.ensureMinEVs(evs, 'spe', 24, evTotal);
        } else if (species.id === 'jirachi') {
          evTotal = this.ensureMinEVs(evs, 'spe', 32, evTotal);
        } else if (species.id === 'celebi') {
          evTotal = this.ensureMinEVs(evs, 'spe', 36, evTotal);
        } else if (species.id === 'volcarona') {
          evTotal = this.ensureMinEVs(evs, 'spe', 52, evTotal);
        } else if (species.id === 'gliscor') {
          evTotal = this.ensureMinEVs(evs, 'spe', 72, evTotal);
        } else if (species.id === 'dragonite' && evs['hp']) {
          evTotal = this.ensureMaxEVs(evs, 'spe', 220, evTotal);
        }
      }

      const SRweaknesses = ['Fire', 'Flying', 'Bug', 'Ice'];
      const SRresistances = ['Ground', 'Steel', 'Fighting'];
      let SRweak = 0;
      if (set.ability !== 'Magic Guard' && set.ability !== 'Mountaineer') {
        if (SRweaknesses.includes(species.types[0])) {
          SRweak++;
        } else if (SRresistances.includes(species.types[0])) {
          SRweak--;
        }
        if (SRweaknesses.includes(species.types[1] || '')) {
          SRweak++;
        } else if (SRresistances.includes(species.types[1] || '')) {
          SRweak--;
        }
      }
      const ensureHPDivisibility = (currentEVTotal: number) => {
        let hpDivisibility = 0;
        let hpShouldBeDivisible = false;
        let hp = evs['hp'] || 0;
        let hpStat = this.getStat('hp', set, hp, 1);
        if (
          (set.item === 'Leftovers' || set.item === 'Black Sludge') &&
          hasMove['substitute'] &&
          hpStat !== 404
        ) {
          hpDivisibility = 4;
        } else if (set.item === 'Leftovers' || set.item === 'Black Sludge') {
          hpDivisibility = 0;
        } else if (hasMove['bellydrum'] && (set.item || '').endsWith('Berry')) {
          hpDivisibility = 2;
          hpShouldBeDivisible = true;
        } else if (hasMove['substitute'] && (set.item || '').endsWith('Berry')) {
          hpDivisibility = 4;
          hpShouldBeDivisible = true;
        } else if (SRweak >= 2 || hasMove['bellydrum']) {
          hpDivisibility = 2;
        } else if (SRweak >= 1 || hasMove['substitute'] || hasMove['transform']) {
          hpDivisibility = 4;
        } else if (set.ability !== 'Magic Guard') {
          hpDivisibility = 8;
        }

        if (hpDivisibility) {
          while (
            hp < maxPoints &&
            currentEVTotal < totalPoints &&
            !(hpStat % hpDivisibility) !== hpShouldBeDivisible
          ) {
            hp += step;
            hpStat = this.getStat('hp', set, hp, 1);
            currentEVTotal += step;
          }
          while (hp > 0 && !(hpStat % hpDivisibility) !== hpShouldBeDivisible) {
            hp -= step;
            hpStat = this.getStat('hp', set, hp, 1);
            currentEVTotal -= step;
          }
          while (hp > 0 && hpStat === this.getStat('hp', set, hp - step, 1)) {
            hp -= step;
            currentEVTotal -= step;
          }
          if (hp || evs['hp']) evs['hp'] = hp;
        }
        return currentEVTotal;
      };
      evTotal = ensureHPDivisibility(evTotal);
      let hpSelected = false;
      while (evTotal < totalPoints) {
        const evTotalBefore = evTotal;
        secondaryStat = null;
        if (!evs['atk'] && moveCount['PhysicalAttack'] >= 1) {
          secondaryStat = 'atk';
        } else if (!evs['spa'] && moveCount['SpecialAttack'] >= 1) {
          secondaryStat = 'spa';
        } else if (!evs['hp'] && stats.hp > 1 && !hpSelected) {
          secondaryStat = 'hp';
        } else if (!evs['spd'] && stats.hp > 1) {
          secondaryStat = 'spd';
        } else if (!evs['def'] && stats.hp > 1) {
          secondaryStat = 'def';
        } else if (!evs['spe']) {
          secondaryStat = 'spe';
        }
        if (!secondaryStat) break;

        ev = Math.min(totalPoints - evTotal, maxPoints);
        stat = this.getStat(secondaryStat, set, ev);
        while (ev > 0 && stat === this.getStat(secondaryStat, set, ev - step)) ev -= step;
        if (ev) evs[secondaryStat] = ev;
        evTotal += ev;

        if (secondaryStat === 'hp') {
          hpSelected = true;
          evTotal = ensureHPDivisibility(evTotal);
          continue;
        }
        if (evTotal === evTotalBefore) break;
      }
    }

    if (hasMove['gyroball'] || hasMove['trickroom']) {
      minusStat = 'spe';
    } else if (!moveCount['PhysicalAttack']) {
      minusStat = 'atk';
    } else if (moveCount['SpecialAttack'] < 1 && !evs['spa']) {
      if (moveCount['SpecialAttack'] < moveCount['PhysicalAttack']) {
        minusStat = 'spa';
      } else if (!evs['atk']) {
        minusStat = 'atk';
      }
    } else if (moveCount['PhysicalAttack'] < 1 && !evs['atk']) {
      minusStat = 'atk';
    } else if (stats.def > stats.spe && stats.spd > stats.spe && !evs['spe']) {
      minusStat = 'spe';
    } else if (plusStat === 'def' || plusStat === 'spd') {
      // defensive set, don't sacrifice the other defensive stat
      // physical moves are frequently run for utility rather than damage
      minusStat = evs['atk'] && !evs['spe'] ? 'spe' : 'atk';
    } else if (stats.def > stats.spd) {
      minusStat = 'spd';
    } else {
      minusStat = 'def';
    }

    if (!minusStat || plusStat === minusStat) {
      minusStat = plusStat === 'spe' ? 'spd' : 'spe';
    }

    evs.plusStat = plusStat;
    evs.minusStat = minusStat;

    return evs;
  }

  getStat(stat: StatID, set: TeamSet, evOverride?: number, natureOverride?: number) {
    const species = this.dex.species.get(set.species);
    if (!species.exists) return 0;

    const level = set.level || 100;

    const baseStat = species.baseStats[stat];

    let iv = set.ivs?.[stat];
    if (typeof iv !== 'number') iv = 31;
    if (this.dex.gen <= 2) iv &= 30;

    let ev = set.evs?.[stat];
    if (typeof ev !== 'number') ev = this.dex.gen > 2 ? 0 : 252;
    if (evOverride !== undefined) ev = evOverride;

    if (stat === 'hp') {
      if (baseStat === 1) return 1;
      if (this.useStatPoints) return baseStat + ev + 75;
      if (this.supportsAVs) return ~~((~~(2 * baseStat + iv + 100) * level) / 100 + 10) + (ev || 0);
      return ~~((~~(2 * baseStat + iv + ~~(ev / 4) + 100) * level) / 100 + 10);
    }
    let val = ~~((~~(2 * baseStat + iv + ~~(ev / 4)) * level) / 100 + 5);
    if (this.useStatPoints) {
      val = baseStat + ev + 20;
    } else if (!this.supportsEVs) {
      val = ~~((~~(2 * baseStat + iv) * level) / 100 + 5);
    }
    if (natureOverride) {
      val *= natureOverride;
    } else if (this.dex.natures.get(set.nature || '')?.plus === stat) {
      val *= 1.1;
    } else if (this.dex.natures.get(set.nature || '')?.minus === stat) {
      val *= 0.9;
    }
    if (this.supportsAVs) {
      const friendshipValue = ~~((70 / 255 / 10 + 1) * 100);
      val = (~~val * friendshipValue) / 100 + (ev || 0);
    }
    return ~~val;
  }
}
