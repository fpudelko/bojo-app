// Polska odmiana rzeczownika przez liczbę.
//
// Powód istnienia: w trzech miejscach w kodzie stała reguła `n < 5`, która jest
// poprawna tylko dla 1-9. Dla 12, 13, 14 dawała formę "mecze" zamiast "meczy",
// a dla 22, 23, 24 odwrotnie. Reguła polska patrzy na ostatnią cyfrę ORAZ na
// przedostatnią: nastolatki (11-14) zawsze biorą formę mnogą dopełniaczową.

/**
 * Zwraca właściwą formę rzeczownika dla liczby `n`.
 *
 *   plural(1,  'mecz', 'mecze', 'meczy') → 'mecz'
 *   plural(3,  'mecz', 'mecze', 'meczy') → 'mecze'
 *   plural(13, 'mecz', 'mecze', 'meczy') → 'meczy'   ← tu psuła się reguła `n < 5`
 *   plural(22, 'mecz', 'mecze', 'meczy') → 'mecze'
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

/** To samo, ale z liczbą z przodu: withCount(3, 'mecz', 'mecze', 'meczy') → '3 mecze'. */
export function withCount(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}
