// Polska odmiana rzeczownika przez liczbę.
//
// Powód istnienia: w trzech miejscach w kodzie stała reguła `n < 5`, która jest
// poprawna tylko dla 1-9. Dla 12, 13, 14 dawała formę "mecze" zamiast "meczów",
// a dla 22, 23, 24 odwrotnie. Reguła polska patrzy na ostatnią cyfrę ORAZ na
// przedostatnią: nastolatki (11-14) zawsze biorą formę mnogą dopełniaczową.
//
// Formę dopełniacza dla "mecz" ujednolicono 2026-09-15 na "meczów" (zgłoszone
// w przeglądzie). Słowniki dopuszczają obie, "meczów" jest tą dominującą —
// a mieszanie ich w jednej aplikacji czyta się jak literówka.

/**
 * Zwraca właściwą formę rzeczownika dla liczby `n`.
 *
 *   plural(1,  'mecz', 'mecze', 'meczów') → 'mecz'
 *   plural(3,  'mecz', 'mecze', 'meczów') → 'mecze'
 *   plural(13, 'mecz', 'mecze', 'meczów') → 'meczów'   ← tu psuła się reguła `n < 5`
 *   plural(22, 'mecz', 'mecze', 'meczów') → 'mecze'
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 1) return one;

  const last = abs % 10;
  const lastTwo = abs % 100;

  // 11-14 to wyjątek: mimo końcówki 2/3/4 biorą formę "many".
  if (lastTwo >= 12 && lastTwo <= 14) return many;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** To samo, ale z liczbą z przodu: withCount(3, 'mecz', 'mecze', 'meczów') → '3 mecze'. */
export function withCount(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}
