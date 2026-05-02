export type PackedTeam = string;

export function importPackedTeam(text: string): PackedTeam {
  return text.trim().replace(/\r\n/g, '\n');
}

export function exportPackedTeam(team: PackedTeam): string {
  return team;
}
