import type { Metadata } from 'next';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { defaultEventTitle } from '@/lib/eventTitle';
import { isPast } from '@/lib/eventWizard';
import { liczZajeteMiejsca } from '@/lib/zajeteMiejsca';
import { withCount } from '@/lib/plural';
import { terazWPolsce, czyPrzedStartemWPolsce } from '@/lib/czasPolski';

// Wydzielone z page.tsx, żeby ten sam odczyt meczu (klient anon, bez sesji —
// obie trasy renderują się po stronie serwera, bez cookies użytkownika) mógł
// współdzielić opengraph-image.tsx (edge runtime), bez importowania czegoś
// z pliku page.tsx.

export interface EventMeta {
  title?: string;
  sport: string;
  date: string;
  time?: string;
  end_time?: string;
  field_name?: string;
  custom_location_name?: string;
  custom_address?: string;
  visibility: string;
  status?: string;
  max_players?: number;
  cost_grosz?: number;
  cover?: string;
  lat: number | null;
  lng: number | null;
  description?: string;
  created_at?: string;
  zapisy_zamkniete?: boolean;
  /** Migracja `123` (`DEFAULT true`) — do `stanPodgladu()` (Z-3): komplet bez
   *  rezerwy i komplet z rezerwą to dwa różne zdania na podglądzie linku. */
  reserve_enabled?: boolean;
}

export async function getEventMeta(id: string): Promise<EventMeta | null> {
  const { data } = await supabase
    .from('events')
    .select(
      'title, sport, event_date, event_time, end_time, field_name, custom_location_name, custom_address, visibility, status, max_players, cost_grosz, cover_image_url, lat, lng, description, created_at, zapisy_zamkniete, reserve_enabled',
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  return {
    title: data.title ?? undefined,
    sport: data.sport,
    date: data.event_date,
    time: data.event_time ?? undefined,
    end_time: data.end_time ?? undefined,
    field_name: data.field_name ?? undefined,
    custom_location_name: data.custom_location_name ?? undefined,
    custom_address: data.custom_address ?? undefined,
    visibility: data.visibility,
    status: data.status ?? undefined,
    max_players: data.max_players ?? undefined,
    cost_grosz: data.cost_grosz ?? undefined,
    cover: data.cover_image_url ?? undefined,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    description: data.description ?? undefined,
    created_at: data.created_at ?? undefined,
    zapisy_zamkniete: data.zapisy_zamkniete ?? false,
    reserve_enabled: data.reserve_enabled ?? true,
  };
}

/**
 * Stan meczu do pokazania komuś, kto DOPIERO dostał link (podgląd na
 * WhatsAppie/Messengerze, `opengraph-image.tsx`) — bez otwierania strony.
 *
 * PO CO. Do Z-3 (docs/faza1-runda10-plan.md) obrazek mówił zawsze
 * „N wolnych miejsc” z odmianą na sztywno („1 wolnych miejsc”), nie znał
 * odwołania, zapisów zamkniętych ani tego, czy mecz już się odbył — odwołany
 * mecz wyglądał na podglądzie jak mecz z wolnymi miejscami. Nigdzie nie padał
 * argument „zapis bez konta”, mimo że to najmocniejszy argument organizatora
 * (strategia.md §0).
 *
 * Czysta funkcja — bez Next.js i bez `Date.now()` bezpośrednio — żeby dało się
 * ją przetestować deterministycznie, tak jak `eventJsonLd()`.
 */
export interface StanPodgladu {
  /** Tekst pigułki na obrazku; pusty string = pigułki nie rysujemy (mecz bez
   *  limitu miejsc). */
  pigulka: string;
  /** Bursztynowe wyróżnienie pigułki — wyłącznie gdy „są wolne miejsca”. */
  wyroznij: boolean;
  /** Czy wolno dopisać „zapis bez zakładania konta” — ta sama bramka co
   *  `zdanieBezKonta()` w `lib/eventShare.ts`: mecz przyjmuje jeszcze kogoś,
   *  wprost albo przez rezerwę. */
  bezKonta: boolean;
}

export function stanPodgladu(
  ev: Pick<EventMeta, 'status' | 'date' | 'time' | 'zapisy_zamkniete' | 'max_players' | 'reserve_enabled'>,
  zajete: number,
  teraz: Date = new Date(),
): StanPodgladu {
  if (ev.status === 'cancelled') {
    return { pigulka: 'Mecz odwołany', wyroznij: false, bezKonta: false };
  }
  // Serwer (edge) stoi na UTC — „czy mecz już był” liczymy w czasie polskim
  // (W-3, lib/czasPolski.ts), inaczej podgląd meczu z wieczora pokazywałby
  // „wolne miejsca” jeszcze godzinę po jego zakończeniu.
  if (!czyPrzedStartemWPolsce(ev.date, ev.time, terazWPolsce(teraz))) {
    return { pigulka: 'Mecz rozegrany', wyroznij: false, bezKonta: false };
  }
  if (ev.zapisy_zamkniete) {
    return { pigulka: 'Zapisy zamknięte', wyroznij: false, bezKonta: false };
  }
  if (!ev.max_players) {
    return { pigulka: '', wyroznij: false, bezKonta: true };
  }
  const wolne = Math.max(0, ev.max_players - zajete);
  if (wolne > 0) {
    return {
      pigulka: withCount(wolne, 'wolne miejsce', 'wolne miejsca', 'wolnych miejsc'),
      wyroznij: true,
      bezKonta: true,
    };
  }
  const rezerwa = ev.reserve_enabled ?? true;
  return {
    pigulka: rezerwa ? 'Komplet, jest rezerwa' : 'Komplet',
    wyroznij: false,
    bezKonta: rezerwa,
  };
}

/**
 * Zajęte miejsca w składzie: bez rezerwowych i bez wierszy czekających na
 * akceptację i BEZ OBSERWUJĄCYCH (`rsvp = 'maybe'`), tak samo jak w
 * opengraph-image.tsx i na karcie meczu. Potrzebne do `offers.availability`
 * w JSON-LD (lib/structuredData.ts). Błąd odczytu daje `undefined`, a wtedy
 * JSON-LD nie zgaduje kompletu.
 *
 * Odczyt z kolumn zamiast `select('*')` — migration 127 usunęła uprawnienia
 * kolumny dla anon user. Rozwidlenie w obie strony (event_participants +
 * opengraph-image) — koniec przychodzenia gościa bez zalogowania.
 */
export async function policzZajeteMiejsca(id: string): Promise<number | undefined> {
  const { data, error } = await supabase
    .from('event_participants')
    .select('is_reserve, pending_approval, rsvp')
    .eq('event_id', id);
  if (error) return undefined;
  return liczZajeteMiejsca(data);
}

/**
 * Metadane strony meczu. Czysta funkcja — bez Supabase i bez Next.js w środku —
 * żeby próg widoczności dało się przetestować tak samo jak `eventJsonLd()`
 * w lib/structuredData.ts.
 *
 * Prywatny mecz jest osiągalny WYŁĄCZNIE przez link dołączenia, więc jego nazwa,
 * termin i miejsce nie mogą wyjść w <title>, <meta name="description"> ani w og:.
 * Wcześniej wychodziły: chroniony był JSON-LD (structuredData.ts), a metadane nie,
 * więc wystarczyło, żeby link raz trafił w publiczne miejsce, i szczegóły meczu
 * mogły wjechać do wyszukiwarki. Ten sam próg obowiązuje w opengraph-image.tsx.
 *
 * Polityka cyklu życia strony meczu (roadmapa SEO/GEO, poz. 21, decyzja
 * właściciela 2026-08-25): rozegrany PUBLICZNY mecz zostaje widoczny dla
 * ludzi (podgląd linku, treść) i dalej ma poprawny `SportsEvent` w JSON-LD,
 * ale przestaje być indeksowalny — miniony mecz jest pustą obietnicą dla
 * kogoś, kto trafi na niego z wyszukiwarki. `follow: true`, żeby robot dalej
 * szedł po linkach ze strony (np. do obiektu), tylko sam adres nie wchodzi
 * do indeksu.
 *
 * `zajete` (Z-3, docs/faza1-runda10-plan.md) — liczba zajętych miejsc, do
 * `stanPodgladu()`, żeby opis i `og:description` mogły dopisać „zapisujesz się
 * bez zakładania konta", tak jak robi to `eventShareText()` przy udostępnianiu
 * z aplikacji. Opcjonalny i bez wartości domyślnej z zapytania: brak `zajete`
 * liczy `bezKonta` tak samo jak przy wolnych miejscach — bezpiecznik, nie
 * zgadywanie kompletu.
 */
export function metadataDlaMeczu(id: string, ev: EventMeta | null, zajete?: number): Metadata {
  // Brak meczu i mecz niepubliczny dostają tę samą, bezcechową odpowiedź — po
  // metadanych nie da się wtedy odróżnić „nie ma takiego meczu" od „jest, ale nie
  // dla ciebie". Neutralna treść — Z-3: dawniej sam tytuł „Mecz" nic nie mówił
  // o tym, co dalej zrobić.
  if (!ev || ev.visibility !== 'public') {
    return {
      title: 'Mecz w Bojo',
      description: 'Otwórz link, żeby zobaczyć szczegóły meczu.',
      robots: { index: false, follow: false },
    };
  }

  let whenStr = '';
  try {
    whenStr = format(parseISO(ev.date), 'EEEE d MMMM', { locale: pl });
  } catch { whenStr = ev.date; }
  const timeStr = ev.time ? ev.time.slice(0, 5) : '';
  const place = ev.field_name || ev.custom_location_name || 'Boisko';
  const name = ev.title || defaultEventTitle(ev.sport, ev.max_players ?? 0);
  const miniony = isPast(ev.date, ev.time ?? '00:00');
  const { bezKonta } = stanPodgladu(ev, zajete ?? 0);

  return {
    // BEZ ręcznego „| Bojo" — sufiks dokłada `title.template` z layout.tsx.
    title: `${name}: ${whenStr}${timeStr ? ` ${timeStr}` : ''}`,
    description: `${ev.sport} • ${whenStr}${timeStr ? `, ${timeStr}` : ''} • ${place}.`
      + (bezKonta ? ' Zapisujesz się bez zakładania konta.' : ''),
    alternates: { canonical: `/wydarzenia/${id}` },
    openGraph: {
      title: `${name} • ${whenStr}${timeStr ? ` ${timeStr}` : ''}`,
      description: `📍 ${place}${bezKonta ? ' · zapis bez konta' : ''}`,
      type: 'website',
    },
    ...(miniony ? { robots: { index: false, follow: true } } : {}),
  };
}
