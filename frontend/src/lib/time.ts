/** Konwersje zegarowego `HH:MM` na minuty od północy i z powrotem — do
 *  przesuwania godziny końca o deltę przy zmianie godziny startu (i vice
 *  versa), np. w modalach "Zmień termin" i "Powtórz mecz". */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
