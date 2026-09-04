import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { supabase } from './supabase';
import { track } from './analytics';
import { eventDisplayTitle } from './eventTitle';
import { kanonicznyOrigin } from './powrotPoLogowaniu';
import type { DaneDoUdostepnienia } from './eventShare';

/**
 * Przejęcie wpisu gościa (migracja `066`).
 *
 * Organizator dopisuje kogoś ręcznie — wpis nie ma właściciela. Ta ścieżka
 * pozwala tej osobie związać wpis ze swoim kontem zamiast zapisywać się drugi
 * raz i zostawiać w składzie dwie pozycje o tym samym imieniu.
 *
 * Cała logika siedzi w funkcjach bazodanowych z `SECURITY DEFINER`, bo wpis
 * gościa z definicji nie należy jeszcze do nikogo — żadna polityka RLS oparta
 * na `auth.uid()` nie mogłaby go przepuścić.
 */

export interface PodgladWpisuGoscia {
  imie: string;
  eventId: string;
  tytul: string;
  data: string;
  godzina: string;
  miejsce: string;
  juzPrzejety: boolean;
  /** Pola z migracji `128`. Stary kształt funkcji ich nie zwracał, więc każde
   *  ma wartość zapasową — inaczej strona „Twój zapis" pokazywałaby pustki
   *  między wdrożeniem kodu a ręcznym uruchomieniem migracji. */
  statusMeczu: 'active' | 'cancelled';
  naRezerwie: boolean;
  czekaNaAkceptacje: boolean;
  kosztGrosze: number;
  wSkladzie: number;
  maxGraczy: number;
  /** Czy z tym wpisem da się jeszcze cokolwiek zrobić: nieprzejęty i przed
   *  pierwszym gwizdkiem. Liczone w bazie, w strefie 'Europe/Warsaw'. */
  moznaZmieniac: boolean;
}

/** Co pokazać klikającemu, zanim się zaloguje. Zwraca null dla nieznanego tokenu. */
export async function podejrzyjWpisGoscia(token: string): Promise<PodgladWpisuGoscia | null> {
  const { data, error } = await supabase.rpc('podejrzyj_wpis_goscia', { p_token: token });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    imie: row.imie,
    eventId: row.event_id,
    tytul: row.tytul,
    data: row.data_meczu,
    godzina: row.godzina,
    miejsce: row.miejsce,
    juzPrzejety: row.juz_przejety,
    statusMeczu: row.status_meczu === 'cancelled' ? 'cancelled' : 'active',
    naRezerwie: row.na_rezerwie ?? false,
    czekaNaAkceptacje: row.czeka_na_akceptacje ?? false,
    kosztGrosze: row.koszt_grosze ?? 0,
    wSkladzie: row.w_skladzie ?? 0,
    maxGraczy: row.max_graczy ?? 0,
    // Bez migracji `128` kolumny nie ma — wtedy „da się zmieniać" wyłącznie
    // wtedy, gdy wpis nie jest jeszcze przejęty. To jest stan przejściowy
    // między deployem a ręcznym puszczeniem migracji, nie docelowy.
    moznaZmieniac: row.mozna_zmieniac ?? !row.juz_przejety,
  };
}

/**
 * Wypisanie ze składu przez sam link — dla gościa bez konta.
 *
 * PO CO. Do migracji `128` zapis gościa był jedynym w Bojo, którego zapisany
 * nie mógł cofnąć: usunąć go mógł wyłącznie organizator. Efekt brał na siebie
 * organizator — skład kłamał dokładnie w tej części, którą sam przyprowadził,
 * a „nie dam rady" i tak przychodziło na WhatsAppie.
 *
 * Uprawnieniem jest sam token, tak jak przy przejęciu wpisu. Baza pilnuje
 * reszty: wpis przejęty ma już właściciela (ten wypisuje się normalnie),
 * a po pierwszym gwizdku składu się nie rusza.
 */
export async function wypiszWpisGoscia(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('wypisz_wpis_goscia', { p_token: token });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Token przejęcia wpisu gościa — dla organizatora albo osoby, która tego
 * gościa dopisała (migracja `127`, funkcja `token_wpisu_goscia`).
 *
 * Do `127` token przychodził wprost w wierszu składu, czyli razem z listą
 * uczestników trafiał do KAŻDEGO, kto otworzył stronę meczu. Dziś wydaje go
 * baza, po sprawdzeniu, kto pyta. `null` znaczy „nie masz prawa albo nie ma
 * już czego przejmować" — dla wywołującego to ta sama sytuacja.
 */
export async function pobierzTokenGoscia(idUczestnika: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('token_wpisu_goscia', { p_uczestnik: idUczestnika });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/** Wiąże wpis z zalogowanym kontem. Zwraca id meczu, żeby było dokąd wrócić. */
export async function przejmijWpisGoscia(token: string, nazwa: string): Promise<string> {
  const { data, error } = await supabase.rpc('przejmij_wpis_goscia', {
    p_token: token,
    p_nazwa: nazwa,
  });
  if (error) throw new Error(error.message);
  // JEDYNY POMIAR REALNEJ KONWERSJI gość → konto. Wcześniej dawało się ją
  // policzyć wyłącznie zapytaniem do bazy po `claimed_at` — czyli nikt jej nie
  // liczył. To jest liczba, wokół której kręci się cały argument
  // „organizator przyprowadza graczy”.
  track('guest_claimed', { eventId: data as string });
  return data as string;
}

/** Link do wysłania gościowi. Domena z `NEXT_PUBLIC_SITE_URL`, tak jak reszta
 *  linków w aplikacji — `bojo.pl` jako wartość zapasowa.
 *
 *  Origin przepuszczamy przez `kanonicznyOrigin()`: organizator na
 *  `www.bojo.pl` wysyłał dotąd link z `www.`, a logowanie z takiego adresu
 *  startuje z innego origin niż ten wpisany na listę dozwolonych w Supabase —
 *  i przekierowanie po zalogowaniu lądowało na stronie głównej zamiast na
 *  stronie przejęcia wpisu. */
export function linkPrzejeciaWpisu(token: string): string {
  const baza =
    typeof window !== 'undefined'
      ? kanonicznyOrigin(window.location.origin)
      : process.env.NEXT_PUBLIC_SITE_URL || 'https://bojo.pl';
  return `${baza}/gracz/przejmij/${token}`;
}

/**
 * Tekst do wysłania RAZEM z linkiem przejęcia wpisu.
 *
 * Bez tego link trafiał na czat jako goły adres — dokładnie ten sam błąd, który
 * już raz naprawiono w głównym udostępnianiu meczu (patrz `eventShareText` w
 * `lib/eventShare.ts`). Tu ta naprawa po prostu nie dotarła.
 *
 * Trzy rzeczy, które ta treść musi robić dobrze — każda była zgłoszona jako
 * błąd poprzedniej wersji:
 *
 * 1. MÓWI, KTO ZAPRASZA. „Organizator dopisał Cię" to nikt konkretny; wiadomość
 *    od nieznajomego z linkiem wygląda jak spam. Dopisujący nie zawsze jest
 *    organizatorem — gdy mecz pozwala uczestnikom dopisywać znajomych, robi to
 *    kolega z drużyny.
 * 2. JEST W CZASIE PRZYSZŁYM. Poprzednia wersja mówiła „Zagraliście razem",
 *    a wpis gościa powstaje przed meczem, nie po nim — zaproszenie na przyszłą
 *    grę brzmiało jak podsumowanie rozegranej.
 * 3. OBIECUJE TO, CO MA WARTOŚĆ. „Zobaczysz swój udział" nie jest zachętą:
 *    skład widać bez konta, wystarczy otworzyć link do meczu. Konto daje
 *    grupę, powiadomienia o kolejnych meczach i własne gry.
 */
export function tekstZaproszeniaGoscia(
  imieGoscia: string,
  e: DaneDoUdostepnienia,
  ktoZaprasza?: string,
): string {
  const tytul = eventDisplayTitle({ title: e.title, sport: e.sport, maxPlayers: e.maxPlayers });
  let kiedy: string;
  try {
    kiedy = format(parseISO(e.date), 'EEEE, d MMMM', { locale: pl });
  } catch {
    kiedy = e.date;
  }

  const zapraszajacy = ktoZaprasza?.trim();
  const wstep = zapraszajacy
    ? `Cześć ${imieGoscia}! ${zapraszajacy} zapisał(a) Cię na mecz`
    : `Cześć ${imieGoscia}! Ktoś zapisał Cię na mecz`;

  return `${wstep} „${tytul}" (${kiedy}) w Bojo.\n`
    + `Masz miejsce w składzie — potwierdź, że to Ty, żeby mecz trafił na Twoją listę gier.\n`
    + `Przy okazji odblokujesz:\n`
    + `• dołączanie do ekipy i powiadomienia o kolejnych meczach,\n`
    + `• zakładanie własnych gier,\n`
    + `• przeglądanie otwartych gier w okolicy (tych wciąż przybywa).\n`
    + `Konto zakładasz Google'em albo e-mailem, zajmuje 30 sekund:`;
}

/** Udostępnia link przejęcia wpisu gościa — Web Share API, z fallbackiem do
 *  schowka. Współdzielone przez przycisk „Zaproś do Bojo" w składzie
 *  (`EventDetailClient.tsx`) i modal zachęty pokazywany zaraz po dodaniu
 *  gościa (`GuestInviteNudge.tsx`), żeby obie ścieżki wysyłały dokładnie tę
 *  samą treść tym samym mechanizmem. */
export async function udostepnijZaproszenieGoscia(
  imieGoscia: string,
  token: string,
  event: DaneDoUdostepnienia,
  ktoZaprasza?: string,
): Promise<'shared' | 'copied' | 'failed'> {
  const url = linkPrzejeciaWpisu(token);
  const text = tekstZaproszeniaGoscia(imieGoscia, event, ktoZaprasza);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Zaproszenie do Bojo', text, url });
      return 'shared';
    } catch {
      return 'failed'; // anulowane przez użytkownika — nic nie pokazujemy, jak w shareEvent()
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
