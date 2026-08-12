// Jedno źródło prawdy dla etykiet drużyn A/B. Dane w bazie i typach zawsze
// używają liter ('A' | 'B') — to tylko warstwa wyświetlania, żeby "Składy"
// i "Wynik meczu" mówiły tym samym językiem (Niebiescy/Czerwoni + N/C),
// zamiast mieszać "Niebiescy" ze "Drużyna A".

export const TEAM_LABELS: Record<'A' | 'B', string> = { A: 'Niebiescy', B: 'Czerwoni' };

export const TEAM_LETTERS: Record<'A' | 'B', string> = { A: 'N', B: 'C' };

export const TEAM_COLOR_CLASSES: Record<'A' | 'B', { pill: string }> = {
  A: { pill: 'bg-blue-100 text-blue-700' },
  B: { pill: 'bg-red-100 text-red-700' },
};
