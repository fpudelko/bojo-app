import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { supabase } from './supabase';
import { track } from './analytics';
import { eventDisplayTitle } from './eventTitle';
import { kanonicznyOrigin } from './powrotPoLogowaniu';
import type { DaneDoUdostepnienia } from './eventShare';
import type { PaymentMethod } from '@/types';
import { KORZYSCI_KONTA } from '@/content/kontoGoscia';

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
  /** Do kiedy stoi oferta zwolnionego miejsca (migracja `137`). `null` = nie ma
   *  stojącej oferty. Do `137` gość na rezerwie oferty nie dostawał NIGDY —
   *  `sync_reserve_claim()` filtrowało `user_id IS NOT NULL`, bo oferta szła
   *  wyłącznie przez `notifications`. */
  ofertaDo: string | null;
  /** Płatność gościa (migracja `163`, W-4). Do `163` gość bez konta widział
   *  pod linkiem wyłącznie kwotę — ani sposobu, ani statusu, ani numeru BLIK.
   *  Każde pole ma wartość zapasową: między deployem frontu a migracją strona
   *  pokazuje to, co dotąd, a nie pustki. */
  metodyPlatnosci: PaymentMethod[];
  metodaPlatnosci: PaymentMethod | null;
  kartaSportowa: boolean;
  znizkaKartyGrosze: number | null;
  pokazStatusPlatnosci: boolean;
  oplacone: boolean;
  /** Numer BLIK — wyłącznie gdy baza uznała, że wolno go pokazać (ta sama
   *  reguła co `canSeeBlikPhone()`). `null` = nie pokazujemy. */
  blikTelefon: string | null;
  /** Numer będzie, ale dopiero godzinę przed meczem. */
  blikPozniej: boolean;
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
    ofertaDo: row.oferta_do ?? null,
    metodyPlatnosci: (row.metody_platnosci ?? []) as PaymentMethod[],
    metodaPlatnosci: (row.metoda_platnosci ?? null) as PaymentMethod | null,
    kartaSportowa: row.karta_sportowa ?? false,
    znizkaKartyGrosze: row.znizka_karty_grosze ?? null,
    pokazStatusPlatnosci: row.pokaz_status_platnosci ?? false,
    oplacone: row.oplacone ?? false,
    blikTelefon: row.blik_telefon ?? null,
    blikPozniej: row.blik_pozniej ?? false,
  };
}

/**
 * Gość przyjmuje zaproponowane miejsce w składzie (migracja `137`).
 *
 * Lustro `acceptReserveClaim()` dla wpisu bez konta. Uprawnieniem jest token,
 * ale sam token NIE WYSTARCZA: baza sprawdza, że oferta faktycznie stoi i nie
 * wygasła. Inaczej link byłby przepustką do składu z pominięciem kolejki —
 * a kolejka jest tym, co organizator obiecał pozostałym rezerwowym.
 */
export async function przyjmijOferteGoscia(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('przyjmij_oferte_goscia', { p_token: token });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Gość odpuszcza zaproponowane miejsce. Odmowa jest OSTATECZNA — tak samo jak
 *  dla konta (migracja `135`): wypada z kolejki, a miejsce idzie dalej. */
export async function odpuscOferteGoscia(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('odpusc_oferte_goscia', { p_token: token });
  if (error) throw new Error(error.message);
  return data as string;
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
 * O czym zaproszenie ma mówić — bramka na treść `tekstZaproszeniaGoscia()`,
 * bo trzy sytuacje potrzebują trzech różnych obietnic (Z-4,
 * docs/faza1-runda10-plan.md).
 */
export interface KontekstZaproszenia {
  /** Wpis jest na liście rezerwowej — nie ma jeszcze miejsca w składzie. */
  naRezerwie: boolean;
  /** Mecz już się odbył — to jest prośba o konto, nie o sprawdzenie zapisu na
   *  mecz, którego już nie ma jak zmienić. */
  poMeczu: boolean;
  /** Mecz płatny i przyjmuje BLIK — link odsłoni numer godzinę przed meczem. */
  blik: boolean;
}

/** „18:00" z „18:00:00" — tekst do wysłania nie potrzebuje sekund. */
function godzinaZaproszenia(t?: string | null): string {
  return (t ?? '').slice(0, 5);
}

/**
 * Tekst do wysłania RAZEM z linkiem przejęcia wpisu.
 *
 * Bez tego link trafiał na czat jako goły adres — dokładnie ten sam błąd, który
 * już raz naprawiono w głównym udostępnianiu meczu (patrz `eventShareText` w
 * `lib/eventShare.ts`). Tu ta naprawa po prostu nie dotarła.
 *
 * DRUGA WERSJA (Z-4, docs/faza1-runda10-plan.md) — poprzednia zawsze mówiła
 * „Masz miejsce w składzie" (nieprawda dla rezerwy i po meczu) i obiecywała
 * konto trzema rzeczami, z których F-6 dwie uznało za nieprawdziwe i usunęło
 * z pozostałych ekranów tej samej ścieżki (`content/kontoGoscia.ts`): konto
 * nie dołącza samo do żadnej ekipy, a otwartych gier w okolicy jest dziś za
 * mało. Tu te same dwie obietnice zostały, bo ten plik miał własną, odrębną
 * treść — teraz korzysta z tej samej listy `KORZYSCI_KONTA`.
 *
 * Przed meczem treść mówi wprost, co link daje BEZ KONTA (skład, koszt,
 * „Nie mogę grać") — to jest dokładnie argument, którym organizator zdejmuje
 * z siebie obsługę „nie dam rady": kliknij, sprawdzisz i sam się wypiszesz.
 * Konto jest propozycją dopiero PO meczu, gdy gość już wie, że chce grać
 * dalej — tam, i tylko tam, treść prosi o coś.
 *
 * Cztery rzeczy, które ta treść musi robić dobrze:
 * 1. MÓWI, KTO ZAPRASZA — jak dotąd.
 * 2. JEST W CZASIE PRZYSZŁYM przed meczem, w przeszłym po meczu.
 * 3. OBIECUJE TO, CO MA WARTOŚĆ i CO JEST PRAWDĄ — bez konta przed meczem,
 *    konto dopiero po.
 * 4. NIE STAWIA ŚCIANY KONTA tam, gdzie nie trzeba — przed meczem to jest
 *    strona JEGO zapisu, nie formularz rejestracji.
 */
export function tekstZaproszeniaGoscia(
  imieGoscia: string,
  e: DaneDoUdostepnienia,
  k: KontekstZaproszenia,
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
  const kto = zapraszajacy ? `${zapraszajacy} zapisał(a) Cię` : 'Ktoś zapisał Cię';
  const godzina = godzinaZaproszenia(e.time);
  const kiedyZGodzina = godzina ? `${kiedy}, ${godzina}` : kiedy;

  if (k.poMeczu) {
    return `Cześć ${imieGoscia}! Dzięki za mecz „${tytul}" (${kiedy}).\n`
      + `Jeśli chcesz grać dalej, załóż konto (30 sekund, Google albo e-mail):\n`
      + KORZYSCI_KONTA.map((k2) => `• ${k2},`).join('\n').replace(/,$/, '.') + '\n'
      + `Załóż konto tutaj:`;
  }

  if (k.naRezerwie) {
    return `Cześć ${imieGoscia}! ${kto} na listę rezerwową meczu „${tytul}" (${kiedyZGodzina}).\n`
      + `Gdy zwolni się miejsce, zobaczysz to pod tym linkiem, bez zakładania konta:\n`
      + `• skład i Twoje miejsce w kolejce,\n`
      + `• „Nie mogę grać", jeśli już nie chcesz czekać.\n`
      + `Otwórz tutaj:`;
  }

  return `Cześć ${imieGoscia}! ${kto} na mecz „${tytul}" (${kiedyZGodzina}).\n`
    + `Pod tym linkiem masz swój zapis, bez zakładania konta:\n`
    + `• skład, miejsce i koszt${k.blik ? ' oraz numer do BLIKA godzinę przed meczem' : ''},\n`
    + `• „Nie mogę grać", gdyby coś wypadło: miejsce przejdzie na kolejną osobę.\n`
    + `Otwórz tutaj:`;
}

/** Udostępnia link przejęcia wpisu gościa — Web Share API, z fallbackiem do
 *  schowka. Współdzielone przez przycisk w składzie (`EventDetailClient.tsx`)
 *  i modal zachęty pokazywany zaraz po dodaniu gościa
 *  (`GuestInviteNudge.tsx`), żeby obie ścieżki wysyłały dokładnie tę samą
 *  treść tym samym mechanizmem. */
export async function udostepnijZaproszenieGoscia(
  imieGoscia: string,
  token: string,
  event: DaneDoUdostepnienia,
  k: KontekstZaproszenia,
  ktoZaprasza?: string,
): Promise<'shared' | 'copied' | 'failed'> {
  const url = linkPrzejeciaWpisu(token);
  const text = tekstZaproszeniaGoscia(imieGoscia, event, k, ktoZaprasza);
  const title = k.poMeczu ? 'Zaproszenie do Bojo' : 'Twój zapis na mecz';

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
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
