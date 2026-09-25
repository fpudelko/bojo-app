/**
 * „Teraz” w Polsce jako napisy porównywalne z `events.event_date` i
 * `events.event_time` — niezależnie od strefy PROCESU.
 *
 * PO CO. Serwer (Vercel) stoi na UTC, gracz jest w Warszawie. Komponent
 * renderowany na serwerze, który liczy „czy mecz już się zaczął” przez
 * `new Date(y, m, d, h, min)`, liczy w UTC: latem przez dwie godziny po starcie
 * mecz wygląda dla serwera na przyszły. Tak sekcja „Możesz dołączyć już dziś”
 * na stronie głównej pokazywała mecz, który już trwa (W-3,
 * docs/faza1-przejscie-e2e-plan.md).
 *
 * Porównanie napisów zamiast `Date`: format `YYYY-MM-DD` i `HH:MM` sortuje się
 * leksykograficznie tak samo jak chronologicznie, a nie trzeba budować daty
 * w obcej strefie (JS nie umie tego bez biblioteki).
 */
const FORMAT_PL = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

export interface ChwilaWPolsce {
  /** `YYYY-MM-DD` */
  data: string;
  /** `HH:MM` */
  godzina: string;
}

export function terazWPolsce(d: Date = new Date()): ChwilaWPolsce {
  // `sv-SE` daje „2026-09-25 18:04” — ISO-podobny zapis bez przecinków.
  const [data, godzina] = FORMAT_PL.format(d).split(' ');
  return { data, godzina: godzina.slice(0, 5) };
}

/** Czy mecz o tej dacie i godzinie (czas polski) jeszcze się nie zaczął.
 *  Brak godziny = koniec dnia, tak jak `isEventJoinable()`. */
export function czyPrzedStartemWPolsce(
  data: string,
  czas: string | null | undefined,
  teraz: ChwilaWPolsce = terazWPolsce(),
): boolean {
  const godzina = (czas ?? '23:59').slice(0, 5);
  return data > teraz.data || (data === teraz.data && godzina > teraz.godzina);
}
