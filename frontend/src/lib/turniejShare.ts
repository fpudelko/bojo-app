// Udostępnianie turnieju — jeden link i jeden tekst dla całej aplikacji,
// wzorem `lib/groupShare.ts`/`lib/eventShare.ts`. Cały tekst jako czysta
// funkcja, żeby dało się go przypiąć testem bez renderowania.
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { kanonicznyOrigin } from './powrotPoLogowaniu';
import { track } from './analytics';
import type { Turniej } from '@/types';

export function linkDoTurnieju(turniejId: string, origin?: string): string {
  const baza = origin
    ? kanonicznyOrigin(origin)
    : (typeof window !== 'undefined' ? kanonicznyOrigin(window.location.origin) : (process.env.NEXT_PUBLIC_SITE_URL || 'https://bojo.pl'));
  return `${baza}/turnieje/${turniejId}`;
}

/** Tekst udostępnienia — data, miejsce i wpisowe, jeśli jest, żeby kapitan
 *  dostał od razu to, co potrzebuje do decyzji, a nie sam link do klikania. */
export function tekstUdostepnieniaTurnieju(
  t: Pick<Turniej, 'nazwa' | 'dataStartu' | 'godzinaStartu' | 'miejsceNazwa' | 'wpisoweGrosze'>,
  link: string,
): string {
  let kiedy = t.dataStartu;
  try {
    kiedy = format(parseISO(t.dataStartu), 'EEEE, d MMMM', { locale: pl });
  } catch {
    // zostaw surową datę
  }

  const linie = [`🏆 ${t.nazwa}: turniej w Bojo`, '', `${kiedy}, godz. ${t.godzinaStartu}`];
  if (t.miejsceNazwa) linie.push(t.miejsceNazwa);
  if (t.wpisoweGrosze > 0) linie.push(`Wpisowe: ${(t.wpisoweGrosze / 100).toFixed(0)} zł/drużyna`);
  linie.push('', 'Zgłoś drużynę:', link);
  return linie.join('\n');
}

export type WynikUdostepnieniaTurnieju = 'shared' | 'copied' | 'failed';

/** Web Share API z fallbackiem do schowka — ten sam wzorzec co
 *  `udostepnijGrupe()`. Anulowanie arkusza też zwraca `'failed'`, bo to nie
 *  jest błąd — wywołujący nic wtedy nie pokazuje. */
export async function udostepnijTurniej(
  t: Pick<Turniej, 'nazwa' | 'dataStartu' | 'godzinaStartu' | 'miejsceNazwa' | 'wpisoweGrosze'>,
  link: string,
): Promise<WynikUdostepnieniaTurnieju> {
  const text = tekstUdostepnieniaTurnieju(t, link);
  let wynik: WynikUdostepnieniaTurnieju;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `${t.nazwa}: turniej w Bojo`, text });
      wynik = 'shared';
    } catch {
      wynik = 'failed';
    }
  } else {
    try {
      await navigator.clipboard.writeText(text);
      wynik = 'copied';
    } catch {
      wynik = 'failed';
    }
  }

  if (wynik !== 'failed') track('turniej_udostepniony', { skad: wynik });
  return wynik;
}
