export type PokemonSet = {
  slot: number;
  name: string;
  species: string;
  hp: number;
  status?: 'BRN' | 'PAR' | 'PSN' | 'SLP' | 'FRZ';
  active?: boolean;
  fainted?: boolean;
};

export type BattleChoice = {
  name: string;
  type: 'Fire' | 'Water' | 'Grass' | 'Electric' | 'Ground' | 'Dark' | 'Fairy' | 'Fighting';
  pp: string;
  cmd: string;
  effectiveness: string;
  disabled?: boolean;
};

export type ArenaBattle = {
  id: string;
  turn: number;
  p1: { name: string; rating: number };
  p2: { name: string; rating: number };
  active: PokemonSet;
  opponentActive: PokemonSet;
  team: PokemonSet[];
  opponentTeam: PokemonSet[];
  moves: BattleChoice[];
  log: string[];
  chat: { user: string; message: string }[];
};

export const demoBattle: ArenaBattle = {
  id: 'demo-gen9ou',
  turn: 12,
  p1: { name: 'You', rating: 1516 },
  p2: { name: 'Rival', rating: 1498 },
  active: { slot: 1, name: 'Iron Valiant', species: 'ironvaliant', hp: 72, active: true },
  opponentActive: { slot: 1, name: 'Great Tusk', species: 'greattusk', hp: 44, active: true },
  team: [
    { slot: 1, name: 'Iron Valiant', species: 'ironvaliant', hp: 72, active: true },
    { slot: 2, name: 'Dragapult', species: 'dragapult', hp: 100 },
    { slot: 3, name: 'Kingambit', species: 'kingambit', hp: 64, status: 'BRN' },
    { slot: 4, name: 'Rotom-Wash', species: 'rotomwash', hp: 38 },
    { slot: 5, name: 'Amoonguss', species: 'amoonguss', hp: 0, fainted: true },
    { slot: 6, name: 'Heatran', species: 'heatran', hp: 88 },
  ],
  opponentTeam: [
    { slot: 1, name: 'Great Tusk', species: 'greattusk', hp: 44, active: true },
    { slot: 2, name: 'Gholdengo', species: 'gholdengo', hp: 91 },
    { slot: 3, name: 'Samurott-Hisui', species: 'samurotthisui', hp: 0, fainted: true },
    { slot: 4, name: 'Dragonite', species: 'dragonite', hp: 100 },
    { slot: 5, name: 'Slowking-Galar', species: 'slowkinggalar', hp: 57, status: 'PAR' },
    { slot: 6, name: 'Enamorus', species: 'enamorus', hp: 84 },
  ],
  moves: [
    { name: 'Moonblast', type: 'Fairy', pp: '11/16', cmd: '/move 1', effectiveness: '2x' },
    { name: 'Close Combat', type: 'Fighting', pp: '7/8', cmd: '/move 2', effectiveness: '1x' },
    { name: 'Thunderbolt', type: 'Electric', pp: '15/24', cmd: '/move 3', effectiveness: '1x' },
    { name: 'Encore', type: 'Dark', pp: '5/8', cmd: '/move 4', effectiveness: 'status' },
  ],
  log: [
    'Turn 12 started.',
    'Pointed stones dug into Great Tusk.',
    'Iron Valiant awaits your command.',
    'The opposing team still has four Pokemon remaining.',
  ],
  chat: [
    { user: 'system', message: 'Rated battle started.' },
    { user: 'spectator', message: 'clean opening position' },
  ],
};

export function buildBattleCommand(choice: BattleChoice | PokemonSet) {
  if ('cmd' in choice) return `Queued ${choice.name}.`;
  return choice.fainted ? `${choice.name} cannot switch in.` : `Queued switch to ${choice.name}.`;
}
