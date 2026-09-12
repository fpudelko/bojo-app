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

/**
 * Cztery linie o odwołanym meczu — do wysłania tam, gdzie ekipa rozmawia.
 *
 * PO CO. `cancelEvent()` powiadamia uczestników Z KONTEM (migracja `070`, plus
 * push). Wyzwalacz ma warunek `user_id IS NOT NULL`, więc GOŚĆ BEZ KONTA nie
 * dostaje nic — a to jest zwykle ta część składu, którą organizator dopiero
 * przyprowadził. Bez tej wiadomości człowiek przyjeżdża na boisko.
 *
 * Świadomie ta sama forma co `eventShareText`: kto dostał zaproszenie, dostaje
 * odwołanie w tym samym kształcie i rozpoznaje je bez czytania.
 */
export function tekstOdwolania(e: DaneDoUdostepnienia, notatka?: string): string {
  const tytul = eventDisplayTitle({ title: e.title, sport: e.sport, maxPlayers: e.maxPlayers });

  let kiedy: string;
  try {
    kiedy = format(parseISO(e.date), 'EEEE, d MMMM', { locale: pl });
  } catch {
    kiedy = e.date;
  }

  const gdzie = eventLocation({
    fieldName: e.fieldName,
    fieldAddress: e.fieldAddress,
    customLocationName: e.customLocationName,
    customAddress: e.customAddress,
    district: e.district,
  });

  const linie = [
    `❌ Odwołane: ${tytul}`,
    `${kiedy} · ${hhmm(e.time)}`,
    gdzie.secondary ? `${gdzie.primary}, ${gdzie.secondary}` : gdzie.primary,
    'Mecz się nie odbędzie.',
  ];
  // Ta sama notatka, którą organizator wpisał w oknie odwołania (migracja
  // `142`) — na czacie ma ją zobaczyć w tej samej wiadomości, nie osobnym
  // wpisem zaraz pod nią. Dopisana na końcu: „Mecz się nie odbędzie" ma
  // zostać pierwszym, jednoznacznym zdaniem niezależnie od długości notatki.
  if (notatka && notatka.trim()) linie.push(notatka.trim());
  return linie.join('\n');
}

/** Otwiera arkusz udostępniania z informacją o odwołaniu; bez `url`, bo nie ma
 *  po co klikać w mecz, który się nie odbędzie — liczy się sama wiadomość. */
export async function udostepnijOdwolanie(e: DaneDoUdostepnienia, notatka?: string): Promise<WynikUdostepnienia> {
  const text = tekstOdwolania(e, notatka);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Mecz odwołany', text });
      return 'shared';
    } catch {
      return 'failed';
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * Cztery linie o meczu, który jednak się odbędzie.
 *
 * PO CO. Migracja `139` powiadamia o przywróceniu DOKŁADNIE te osoby, które
 * dostały wcześniej `mecz_odwolany` — ale gość bez konta i tak dostaje mail
 * tylko wtedy, gdy ma zapisany adres, a kto go nie podał, nie dowie się
 * niczym poza czatem. Ten sam powód, dla którego istnieje `tekstOdwolania`.
 *
 * Świadomie ta sama czterolinijkowa forma co `eventShareText`
 * i `tekstOdwolania`: ekipa rozpoznaje kształt bez czytania, a różnicę niesie
 * pierwsza linia.
 */
export function tekstPrzywrocenia(e: DaneDoUdostepnienia): string {
  const tytul = eventDisplayTitle({ title: e.title, sport: e.sport, maxPlayers: e.maxPlayers });

  let kiedy: string;
  try {
    kiedy = format(parseISO(e.date), 'EEEE, d MMMM', { locale: pl });
  } catch {
    kiedy = e.date;
  }

  const gdzie = eventLocation({
    fieldName: e.fieldName,
    fieldAddress: e.fieldAddress,
    customLocationName: e.customLocationName,
    customAddress: e.customAddress,
    district: e.district,
  });

  const start = hhmm(e.time);
  const koniec = hhmm(e.endTime);

  return [
    `✅ Wraca: ${tytul}`,
    `${kiedy} · ${koniec ? `${start}–${koniec}` : start}`,
    gdzie.secondary ? `${gdzie.primary}, ${gdzie.secondary}` : gdzie.primary,
    'Mecz jednak się odbędzie.',
  ].join('\n');
}

/**
 * Wiadomość o zmianie w meczu — z wypunktowaniem „było → jest".
 *
 * PO CO. `065` i `114` powiadamiają uczestników Z KONTEM, `133` — gości
 * z zapisanym adresem. Zostaje gość bez adresu, czyli zwykle ta część składu,
 * którą organizator sam przyprowadził. Dla niego czat jest jedynym kanałem —
 * dokładnie ten sam powód, dla którego istnieje `tekstOdwolania`.
 *
 * `zmiany` przychodzą gotowe z `lib/zmianyMeczu.ts`, żeby nie było dwóch
 * niezależnych opisów tej samej zmiany: to, co widzi organizator w oknie
 * potwierdzenia, i to, co wysyła na czat, musi być tym samym zdaniem.
 */
export function tekstZmiany(
  e: DaneDoUdostepnienia,
  zmiany: { etykieta: string; przed: string; po: string }[],
): string {
  const tytul = eventDisplayTitle({ title: e.title, sport: e.sport, maxPlayers: e.maxPlayers });

  let kiedy: string;
  try {
    kiedy = format(parseISO(e.date), 'EEEE, d MMMM', { locale: pl });
  } catch {
    kiedy = e.date;
  }

  const gdzie = eventLocation({
    fieldName: e.fieldName,
    fieldAddress: e.fieldAddress,
    customLocationName: e.customLocationName,
    customAddress: e.customAddress,
    district: e.district,
  });

  const start = hhmm(e.time);
  const koniec = hhmm(e.endTime);

  return [
    `🔄 Zmiana: ${tytul}`,
    ...zmiany.map((z) => `${z.etykieta}: ${z.przed} → ${z.po}`),
    '',
    `${kiedy} · ${koniec ? `${start}–${koniec}` : start}`,
    gdzie.secondary ? `${gdzie.primary}, ${gdzie.secondary}` : gdzie.primary,
  ].join('\n');
}

/** Otwiera arkusz udostępniania z opisem zmiany. Z adresem meczu — inaczej niż
 *  przy odwołaniu, bo tutaj jest po co kliknąć: aktualny stan składu i miejsca
 *  jest właśnie tym, co ekipa ma sprawdzić. */
export async function udostepnijZmiane(
  e: DaneDoUdostepnienia,
  zmiany: { etykieta: string; przed: string; po: string }[],
  url: string,
): Promise<WynikUdostepnienia> {
  const text = tekstZmiany(e, zmiany);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Zmiana w meczu', text, url });
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

/**
 * Otwiera arkusz udostępniania z informacją o przywróceniu meczu.
 *
 * W ODRÓŻNIENIU OD ODWOŁANIA — z adresem meczu. Przy odwołaniu link nie ma po
 * co istnieć, bo nie ma w co klikać; tutaj jest odwrotnie: to jest zaproszenie
 * z powrotem do składu, więc adres jest w nim najważniejszy.
 */
export async function udostepnijPrzywrocenie(
  e: DaneDoUdostepnienia,
  url: string,
): Promise<WynikUdostepnienia> {
  const text = tekstPrzywrocenia(e);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Mecz jednak się odbędzie', text, url });
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

/** Tekst + adres w jednej linijce niżej — to samo, co dziś robi fallback
 *  schowka w `shareEvent()`. Wydzielone, żeby przyciski „Kopiuj link" (pasek
 *  meczu, panel „Zaproś znajomych") nie kopiowały gołego adresu — to ten sam
 *  błąd, który `shareEvent()` naprawiał dla `navigator.share`. */
export function textDoKopiowania(e: DaneDoUdostepnienia, url: string): string {
  return `${eventShareText(e)}\n${url}`;
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
    await navigator.clipboard.writeText(textDoKopiowania(e, url));
    return 'copied';
  } catch {
    return 'failed';
  }
}
