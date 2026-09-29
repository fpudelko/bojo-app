/**
 * Daty pokazywane w animacji na pierwszym ekranie strony głównej.
 *
 * Animacja zakłada mecz „na najbliższy czwartek”. Do 2026-09-29 te napisy
 * („01.10.2026”, „czwartek, 1 października”, „za 3 dni”) siedziały wpisane na
 * sztywno w znacznikach ekranów, więc po pierwszym października pokazywałyby
 * datę z przeszłości. Liczymy je od „dziś” w Polsce (`lib/czasPolski.ts`),
 * nigdy od strefy procesu: serwer stoi na UTC, gracz jest w Warszawie.
 *
 * Czysta funkcja bez `Date.now()` w środku: dzień podaje się z zewnątrz, więc
 * test sprawdza dowolną datę, także przełom miesiąca i roku.
 */
import { terazWPolsce } from './czasPolski';

const DNI = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MIESIACE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];
const CZWARTEK = 4;

export interface DatyHero {
  /** Data początkowa w polu kreatora, `DD.MM.RRRR` (jutro). */
  start: string;
  /** Podpis pod polem daty na początku, np. „wtorek, 29 września · jutro”. */
  startOpis: string;
  /** Data meczu w polu kreatora po wybraniu, `DD.MM.RRRR`. */
  cel: string;
  /** Podpis pod polem daty po wybraniu, np. „czwartek, 1 października · za 3 dni”. */
  celOpis: string;
  /** „czwartek, 1 października” (małą literą, do podsumowania przed publikacją). */
  celDluga: string;
  /** „Czwartek, 1 października” (wielką literą, do kart meczu). */
  celDlugaWielka: string;
}

/** Dzień o `plus` dni po `iso` (`YYYY-MM-DD`), liczony w UTC, czyli bez skoków
 *  czasu letniego. */
function dzienPo(iso: string, plus: number): Date {
  const [r, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(r, m - 1, d + plus));
}

const dwie = (n: number) => String(n).padStart(2, '0');
const numerycznie = (dt: Date) => `${dwie(dt.getUTCDate())}.${dwie(dt.getUTCMonth() + 1)}.${dt.getUTCFullYear()}`;
const slownie = (dt: Date) => `${DNI[dt.getUTCDay()]}, ${dt.getUTCDate()} ${MIESIACE[dt.getUTCMonth()]}`;

/**
 * @param dzisIso `YYYY-MM-DD`, domyślnie dziś w Polsce.
 *
 * Mecz jest w najbliższy czwartek, ale najwcześniej za 2 dni: „za 1 dzień” to
 * inna odmiana, a pole daty startuje na „jutro”, więc data meczu musi być
 * później niż ta początkowa, żeby dotknięcie pola coś zmieniało.
 */
export function datyHero(dzisIso: string = terazWPolsce().data): DatyHero {
  const jutro = dzienPo(dzisIso, 1);
  let za = 2;
  while (dzienPo(dzisIso, za).getUTCDay() !== CZWARTEK) za++;
  const cel = dzienPo(dzisIso, za);
  const opisCelu = slownie(cel);
  return {
    start: numerycznie(jutro),
    startOpis: `${slownie(jutro)} · jutro`,
    cel: numerycznie(cel),
    celOpis: `${opisCelu} · za ${za} dni`,
    celDluga: opisCelu,
    celDlugaWielka: opisCelu[0].toUpperCase() + opisCelu.slice(1),
  };
}
