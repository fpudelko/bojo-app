// Gry cykliczne (stałe gierki, tabele `recurring_events`/`recurring_event_invites`)
// usunięte całkowicie (decyzja właściciela, runda 9) — patrz AGENTS.md, „Zanim
// uznasz, że funkcja nie istnieje". Funkcje niżej zostają, bo liczą matematykę
// dat dla ZUPEŁNIE INNEJ, niezależnej funkcji: „Powtórz mecz” (repeat-once,
// `handleOpenRepeat`/`handleRepeat` w `EventDetailClient.tsx`).

/** `YYYY-MM-DD` z lokalnej daty. Nie `toISOString()`: ten przelicza na UTC
 *  i w naszej strefie potrafi cofnąć wynik o dzień. */
function jakoData(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Data najbliższego wystąpienia podanego dnia tygodnia (1=pon … 7=niedz) od
 * `teraz` — a gdy wypada dziś i godzina już minęła, za tydzień. Bez tego
 * drugiego warunku „następny termin" pokazywałby mecz kilka godzin po jego
 * zakończeniu.
 */
export function nastepnyTermin(dayOfWeek: number, eventTime: string, teraz = new Date()): string {
  const dzisIso = teraz.getDay() === 0 ? 7 : teraz.getDay();
  let odstep = (dayOfWeek - dzisIso + 7) % 7;
  if (odstep === 0) {
    const godzinaTeraz = `${String(teraz.getHours()).padStart(2, '0')}:${String(teraz.getMinutes()).padStart(2, '0')}`;
    if ((eventTime || '').slice(0, 5) <= godzinaTeraz) odstep = 7;
  }
  const cel = new Date(teraz);
  cel.setDate(teraz.getDate() + odstep);
  return jakoData(cel);
}

/**
 * Domyślny termin dla „Powtórz mecz": ten sam dzień tygodnia i godzina co
 * pierwowzór, pierwszy raz w przyszłości — mecz sprzed miesiąca daje
 * najbliższą przyszłą sobotę, nie sobotę sprzed trzech tygodni. Okno
 * „Powtórz mecz" otwierało się dotąd z pustym polem daty i zablokowanym
 * przyciskiem; to jest dokładnie ta sama matematyka, którą `nastepnyTermin()`
 * już robi, tylko liczona od jednorazowego meczu zamiast od zapisanego
 * `dayOfWeek`.
 */
export function domyslnyTerminPowtorki(date: string, time: string, teraz = new Date()): string {
  const [y, m, d] = date.split('-').map(Number);
  const zrodlo = new Date(y, (m || 1) - 1, d || 1);
  const dayOfWeek = zrodlo.getDay() === 0 ? 7 : zrodlo.getDay();
  return nastepnyTermin(dayOfWeek, time, teraz);
}

/** Ile dni dzieli dziś od podanej daty (ujemne = przeszłość). */
export function dniDo(data: string, teraz = new Date()): number {
  const [y, m, d] = data.split('-').map(Number);
  const cel = new Date(y, m - 1, d);
  const dzis = new Date(teraz.getFullYear(), teraz.getMonth(), teraz.getDate());
  return Math.round((cel.getTime() - dzis.getTime()) / 86_400_000);
}
