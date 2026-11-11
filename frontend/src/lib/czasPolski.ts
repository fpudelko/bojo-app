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

/** Chwila (ISO z bazy, zwykle w UTC) jako data i godzina w POLSCE.
 *  Do wyświetlania `turniej_mecze.zaplanowany_at`: PostgREST oddaje
 *  `2026-11-28T09:00:00+00:00`, a wycięcie `slice(11, 16)` dawało „09:00"
 *  dla meczu o 10:00 w Warszawie (turniej w Luboniu, audyt 6 i 7). */
export function chwilaWPolsce(iso: string): ChwilaWPolsce {
  return terazWPolsce(new Date(iso));
}

/** Data i godzina w Polsce → chwila ISO w UTC, niezależnie od strefy
 *  przeglądarki. Generator terminarza budował start z `new Date('…T10:00:00')`,
 *  czyli w strefie URZĄDZENIA: organizator z telefonem ustawionym na inną
 *  strefę układał mecze przesunięte o różnicę. */
export function instantZCzasuPolskiego(data: string, godzina: string): string {
  const [r, mies, d] = data.split('-').map(Number);
  const [h, min] = godzina.slice(0, 5).split(':').map(Number);
  // Zgadujemy UTC, sprawdzamy, którą godzinę to daje w Polsce, i poprawiamy
  // o różnicę. Dwie iteracje wystarczają także w dniu zmiany czasu.
  let t = Date.UTC(r, mies - 1, d, h, min);
  for (let i = 0; i < 2; i++) {
    const pl = terazWPolsce(new Date(t));
    const [pr, pm, pd] = pl.data.split('-').map(Number);
    const [ph, pmin] = pl.godzina.split(':').map(Number);
    const roznica = Date.UTC(r, mies - 1, d, h, min) - Date.UTC(pr, pm - 1, pd, ph, pmin);
    if (roznica === 0) break;
    t += roznica;
  }
  return new Date(t).toISOString();
}
