// Udostępnianie meczu: jeden adres i jeden tekst dla całej aplikacji.
//
// Skąd to się wzięło. Strona meczu miała DWA różne linki pod przyciskami o tej
// samej nazwie „Udostępnij": pasek górny wysyłał `window.location.href`
// (/wydarzenia/<uuid>), a panel „Zaproś znajomych" — /d/<kod>. Do tego
// `navigator.share` dostawał sam adres, bez daty, miejsca i ceny, więc na
// czacie lądował goły odnośnik. Post na grupie WhatsApp niósł więcej informacji
// niż udostępnienie z Bojo — czyli dokładnie odwrotnie, niż obiecuje produkt.
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { sportEmoji } from './sports';
import { eventDisplayTitle } from './eventTitle';
import { eventLocation } from './utils';
import { withCount } from './plural';
import type { EventItem } from '@/types';

/**
 * Kanoniczny adres meczu.
 *
 * Celowo NIE `/d/{joinCode}`, choć jest krótszy: `robots.ts` trzyma `/d/` poza
 * indeksowaniem (kod dołączenia to jedyna kontrola dostępu do meczu
 * prywatnego), a crawlery Facebooka i WhatsAppa respektują robots.txt — więc
 * krótki link leci na czat BEZ podglądu. Trasa `/d/[code]` żyje dalej dla
 * linków już rozesłanych, po prostu nie jest tym, co proponujemy do wysłania.
 */
export function eventUrl(eventId: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}/wydarzenia/${eventId}`;
}

/** Pola meczu potrzebne do złożenia tekstu — węższe niż cały `EventItem`,
 *  żeby dało się to wołać także z listy, gdzie wiersz bywa niepełny. */
export type DaneDoUdostepnienia = Pick<
  EventItem,
  'sport' | 'title' | 'maxPlayers' | 'date' | 'time' | 'endTime' | 'costGrosze'
> & Partial<Pick<EventItem,
  'fieldName' | 'fieldAddress' | 'customLocationName' | 'customAddress' | 'district'
>>;

/** „18:00" z „18:00:00" — baza zwraca godziny z sekundami, czat ich nie potrzebuje. */
function hhmm(t?: string | null): string {
  return (t ?? '').slice(0, 5);
}

/**
 * Cztery linie do wklejenia na czat:
 *
 *   ⚽ Piłka nożna 7v7
 *   środa, 12 sierpnia · 18:00–19:30
 *   Orlik Sołacz, ul. Niestachowska 8
 *   14 miejsc · 20 zł od osoby
 *
 * Bez języka marketingowego i bez wołania o kliknięcie — to ma wyglądać jak
 * dobrze napisany post organizatora, nie jak reklama aplikacji. Adres meczu
 * dokładany jest osobno (patrz `shareEvent`), żeby podgląd linku nadal działał.
 */
export function eventShareText(e: DaneDoUdostepnienia): string {
  const linie: string[] = [];

  linie.push(`${sportEmoji(e.sport)} ${eventDisplayTitle({
    title: e.title, sport: e.sport, maxPlayers: e.maxPlayers,
  })}`);

  let kiedy: string;
  try {
    kiedy = format(parseISO(e.date), 'EEEE, d MMMM', { locale: pl });
  } catch {
    kiedy = e.date;
  }
  const start = hhmm(e.time);
  const koniec = hhmm(e.endTime);
  // Półpauza, nie myślnik — to zakres godzin, a nie dywiz.
  linie.push(`${kiedy} · ${koniec ? `${start}–${koniec}` : start}`);

  const gdzie = eventLocation({
    fieldName: e.fieldName,
    fieldAddress: e.fieldAddress,
    customLocationName: e.customLocationName,
    customAddress: e.customAddress,
    district: e.district,
  });
  linie.push(gdzie.secondary ? `${gdzie.primary}, ${gdzie.secondary}` : gdzie.primary);

  // `withCount` zamiast reguły `n < 5`: ta myli się na 12–14, a 14 to domyślny
  // skład piłkarski w kreatorze — czyli najczęstsza liczba w całej aplikacji.
  const miejsca = withCount(e.maxPlayers, 'miejsce', 'miejsca', 'miejsc');
  const cena = e.costGrosze > 0
    ? `${(e.costGrosze / 100).toFixed(2).replace('.', ',')} zł od osoby`
    : 'za darmo';
  linie.push(`${miejsca} · ${cena}`);

  return linie.join('\n');
}

export type WynikUdostepnienia = 'shared' | 'copied' | 'failed';

/**
 * Otwiera systemowy arkusz udostępniania, a gdy przeglądarka go nie ma —
 * kopiuje tekst razem z adresem do schowka.
 *
 * `url` przekazujemy osobno od `text`, żeby cel udostępnienia mógł zbudować
 * podgląd linku. Anulowanie arkusza przez użytkownika też zwraca `'failed'` —
 * wywołujący ma wtedy NIC nie pokazywać, bo to nie jest błąd.
 */
export async function shareEvent(
  e: DaneDoUdostepnienia,
  url: string,
): Promise<WynikUdostepnienia> {
  const text = eventShareText(e);
  const title = eventDisplayTitle({ title: e.title, sport: e.sport, maxPlayers: e.maxPlayers });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch {
      return 'failed';
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
