import { supabase } from './supabase';

/**
 * App-wide analytics events. Fire-and-forget — analytics must never block or
 * break a user action, so all failures are swallowed with a console warning.
 * Read by the admin dashboard at /admin/analityka.
 */
export type AnalyticsEvent =
  | 'login'
  | 'event_created'
  | 'event_joined'
  | 'group_created'
  | 'group_joined'
  // ── LEJEK ORGANIZATORA (2026-09-03) ──────────────────────────────────────
  // Pięć zdarzeń wyżej mówi, ILE rzeczy powstało. Nie mówią, gdzie ludzie
  // odpadają — a audyt ścieżki organizatora sam sobie to wypomniał:
  // „dopóki nie wiadomo, ilu ludzi odpada na którym kroku, kolejność napraw
  // jest sądem, nie pomiarem”. Poniższe siedem odpowiada na pytania, których
  // bez nich nie da się zadać.
  /** Wejście na krok kreatora (`{ krok: 1|2|3 }`) — gdzie kończy się „dwie minuty”. */
  | 'wizard_step'
  /** Otwarcie okna „Tak zobaczą to gracze” — ilu doszło do publikacji i się wycofało. */
  | 'wizard_summary_open'
  /** Organizator wysłał link (`{ eventId, skad }`) — czy pętla viralowa w ogóle rusza. */
  | 'event_shared'
  /** Ktoś otworzył stronę meczu z linku spoza Bojo. Jedyne zdarzenie, które
   *  powstaje też dla NIEZALOGOWANYCH (polityka INSERT dopuszcza `user_id IS NULL`)
   *  — bez tego nie da się policzyć „ilu otworzyło link, ilu weszło do składu”,
   *  czyli miary, wokół której kręci się cała faza 1. */
  | 'event_link_opened'
  /** Zapis bez konta — jaka część składu wchodzi tą drogą. */
  | 'guest_joined'
  /** Gość zamienił wpis na konto — realna konwersja, dziś nieznana. */
  | 'guest_claimed'
  /** Organizator wysłał rozliczenie ekipie — czy domknięcie po meczu wychodzi poza jego ekran. */
  | 'settlement_shared'
  /** Organizator wysłał skład na czat (F-4) — czy zamiennik posta z WhatsAppa jest używany. */
  | 'squad_shared'
  /** „Powtórz mecz” zaprosiło N osób z poprzedniego składu (F-5, `{ eventId, ile }`). */
  | 'repeat_invited'
  /** Ktoś pobrał termin meczu jako `.ics` (`{ eventId }`). Mierzy, czy kalendarz
   *  telefonu jest realną drogą powrotu na mecz, czy tylko naszym założeniem —
   *  bez tego licznika „Do kalendarza" zostaje przyciskiem, o którym nie da się
   *  powiedzieć, czy ktokolwiek go dotyka. Kolumna `event_type` to zwykły TEXT
   *  bez ograniczenia (migracja `047`), więc nowa wartość nie wymaga migracji. */
  | 'event_do_kalendarza'
  // ── MODUŁ TURNIEJOWY (145, Etap 0) ───────────────────────────────────────
  /** Turniej utworzony — od kreatora do publikacji. */
  | 'turniej_utworzony'
  /** Drużyna zgłoszona (samodzielnie albo dodana ręcznie). */
  | 'turniej_druzyna_zgloszona'
  /** Ktoś dołączył do drużyny linkiem `/t/[kod]` — kapitanat, „to ja" albo nowy wpis. */
  | 'turniej_dolaczyl_do_druzyny'
  /** Mecz poprowadzony do końca konsolą prowadzącego (Etap 2). */
  | 'turniej_mecz_poprowadzony'
  /** Organizator wysłał link do turnieju/drużyny dalej. */
  | 'turniej_udostepniony'
  // ── MODUŁ TURNIEJOWY (150, Etap 4) ───────────────────────────────────────
  /** Kapitan zamienił drużynę turniejową w trwałą ekipę jednym przyciskiem. */
  | 'turniej_zamieniony_w_ekipe'
  // ── MODUŁ TURNIEJOWY (154) ───────────────────────────────────────────────
  /** Kapitan zaprosił imiennie ludzi ze swojej ekipy do drużyny turniejowej.
   *  Mierzymy to osobno od linku (`turniej_udostepniony`), bo to dwie różne
   *  drogi kompletowania składu i dopiero porównanie powie, która działa. */
  | 'turniej_zaproszenia_wyslane'
  // ── KATALOG BOISK W WYNIKACH WYSZUKIWANIA (2026-09-16) ────────────────────
  // Powód jest liczbowy. Od 5.09.2026 Google ma w indeksie 17 473 stron Bojo,
  // a eksport Search Console z 16.09 pokazał, że **980 z 1000 stron zbierających
  // wyświetlenia to `/boisko/*`** — cały ruch z wyszukiwarki wchodzi dziś przez
  // katalog. I do tej pory NIC z tego nie było mierzone: `track()` wołały
  // wyłącznie strona meczu i kreator, więc o 116 osobach tygodniowo wiedzieliśmy
  // tyle, że kliknęły w Google, i ani słowa o tym, co zrobiły dalej.
  //
  // To jest ta sama luka, którą lejek organizatora wyżej sam sobie wypomniał:
  // bez niej kolejność napraw na stronie obiektu jest sądem, nie pomiarem. Różnica
  // polega na tym, że tamtych danych dawało się nie mieć — a tych nie da się
  // odtworzyć wstecz: każdy tydzień bez pomiaru to tydzień ruchu stracony bezpowrotnie.
  /** Wejście na stronę obiektu (`{ fieldId, zrodlo }`). `zrodlo` z `zrodloWejscia()` —
   *  rozdziela ruch z wyszukiwarki, z modelu językowego, wewnętrzny i bezpośredni. */
  | 'boisko_otwarte'
  /** Kliknięcie „Zorganizuj tutaj" (`{ fieldId, zrodlo }`) — jedyna realna konwersja
   *  na tej stronie i jedyny pomost między ruchem z katalogu a fazą 1 (organizatorzy). */
  | 'boisko_zorganizuj'
  /** Kliknięcie w pobliski obiekt (`{ fieldId, celId, pozycja }`) — czy warstwa
   *  dołożona 2026-09-02 (`lib/pobliskieObiekty.ts`) w ogóle żyje, czy jest ozdobą. */
  | 'boisko_pobliskie'
  // ── AMUNICJA DLA ORGANIZATORA (2026-09-18) ────────────────────────────────
  /** Organizator skopiował gotowy tekst dla ekipy (`{ wariant }`) z sekcji
   *  „Co napisać ekipie" na /dlaczego-bojo. Mierzy, czy amunicja jest w ogóle
   *  brana do ręki — bez tego sekcja zostaje naszym założeniem, nie faktem.
   *  Kolumna `event_type` to zwykły TEXT bez ograniczenia (migracja `047`),
   *  więc nowa wartość nie wymaga migracji. */
  | 'argument_skopiowany';

/** Skąd przyszedł człowiek — wyprowadzone z `document.referrer`. */
export type ZrodloWejscia = 'wyszukiwarka' | 'model' | 'wewnetrzne' | 'bezposrednie' | 'zewnetrzne';

const WYSZUKIWARKI = [
  'google.', 'bing.com', 'duckduckgo.com', 'search.yahoo.', 'yandex.',
  'ecosia.org', 'search.brave.com', 'startpage.com', 'seznam.cz', 'onet.pl/szukaj',
];

// Silniki generatywne osobno od wyszukiwarek — to jest JEDYNY sposób, żeby
// odpowiedzieć na pytanie, wokół którego kręci się cała warstwa GEO strategii:
// czy modele w ogóle odsyłają ludzi na bojo.pl. Załącznik A próbuje to zmierzyć
// ręcznie, czterdziestoma promptami raz na sześć tygodni; ta lista mierzy skutek,
// nie deklarację. Uwaga na granice metody: część klientów (aplikacje mobilne,
// odpowiedzi bez linku) nie przekazuje referrera wcale i wpadnie w „bezposrednie",
// więc liczba jest DOLNYM oszacowaniem, nigdy pełnym.
const MODELE = [
  'chatgpt.com', 'chat.openai.com', 'perplexity.ai', 'claude.ai',
  'gemini.google.com', 'bard.google.com', 'copilot.microsoft.com', 'you.com',
];

/**
 * Czysta funkcja, żeby dało się ją sprawdzić bez przeglądarki — `document.referrer`
 * bywa pusty z powodów, których nie da się odtworzyć w teście (polityka referrera
 * po stronie strony wysyłającej, przejście z HTTPS na HTTP, otwarcie z aplikacji).
 *
 * `wlasnaDomena` podajemy zamiast czytać `window.location`, żeby test mógł podstawić
 * dowolną — na podglądzie Vercela domena jest inna niż na produkcji, a wejście
 * z jednej podstrony na drugą ma się liczyć jako wewnętrzne w obu środowiskach.
 */
export function zrodloWejscia(referrer: string | null | undefined, wlasnaDomena: string): ZrodloWejscia {
  const ref = (referrer ?? '').trim().toLowerCase();
  if (!ref) return 'bezposrednie';

  let host: string;
  try {
    host = new URL(ref).hostname;
  } catch {
    // Referrer nie do sparsowania zdarza się realnie (rozszerzenia, klienty pocztowe).
    // „zewnetrzne" jest uczciwsze niż odgadywanie po fragmencie tekstu.
    return 'zewnetrzne';
  }

  if (host === wlasnaDomena.toLowerCase() || host.endsWith(`.${wlasnaDomena.toLowerCase()}`)) {
    return 'wewnetrzne';
  }
  if (MODELE.some((m) => host === m || host.endsWith(`.${m}`))) return 'model';
  if (WYSZUKIWARKI.some((w) => host.includes(w))) return 'wyszukiwarka';
  return 'zewnetrzne';
}

export async function track(
  eventType: AnalyticsEvent,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    await supabase.from('analytics_events').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      event_type: eventType,
      path: typeof window !== 'undefined' ? window.location.pathname : null,
      metadata: metadata ?? null,
    });
  } catch (e) {
    console.warn('[analytics]', eventType, e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ODCZYT POMIARU — funkcje czyste, używane przez `/admin/analityka`.
//
// Wydzielone z JSX tym samym wzorcem co `lib/hubKatalogu.ts` i z tego samego
// powodu: Vitest nie transformuje `.tsx` w tym repo, a reguła „co liczy się do
// pozyskania" jest dokładnie tą, której nie wolno zepsuć po cichu. Panel
// pokazywał dotąd wyłącznie typ zdarzenia, więc `zrodlo` — jedyny powód, dla
// którego ten pomiar powstał — dało się odczytać tylko zapytaniem SQL.
// ─────────────────────────────────────────────────────────────────────────────

const ZRODLA_ZNANE: readonly string[] = [
  'wyszukiwarka', 'model', 'zewnetrzne', 'bezposrednie', 'wewnetrzne',
];

/** Źródło ze zdarzenia. Wartość spoza listy traktujemy jak brak — metadane
 *  przychodzą z przeglądarki, więc nie są kontraktem, tylko danymi wejściowymi. */
export function zrodloZdarzenia(metadata: unknown): string {
  const z = (metadata as { zrodlo?: unknown } | null | undefined)?.zrodlo;
  return typeof z === 'string' && ZRODLA_ZNANE.includes(z) ? z : 'nieznane';
}

/** Rozbicie wejść po źródle, malejąco, bez pozycji zerowych. */
export function rozbicieWgZrodla(
  zdarzenia: readonly { metadata: unknown }[],
): { zrodlo: string; ile: number }[] {
  const licznik = new Map<string, number>();
  for (const z of zdarzenia) {
    const k = zrodloZdarzenia(z.metadata);
    licznik.set(k, (licznik.get(k) ?? 0) + 1);
  }
  // `Array.from`, nie spread — `tsconfig` celuje niżej niż ES2015 dla iteratorów,
  // więc `[...mapa.entries()]` nie kompiluje się bez `downlevelIteration`.
  return Array.from(licznik.entries())
    .map(([zrodlo, ile]) => ({ zrodlo, ile }))
    .sort((a, b) => b.ile - a.ile || a.zrodlo.localeCompare(b.zrodlo));
}

/**
 * Konwersja na „Zorganizuj tutaj", liczona WYŁĄCZNIE na ruchu spoza Bojo.
 *
 * Wejścia wewnętrzne (mapa, wyszukiwarka w aplikacji, powrót z innego boiska)
 * rozmyłyby jedyną liczbę, dla której ten pomiar powstał: ilu ludzi Z ZEWNĄTRZ
 * robi krok w stronę zostania organizatorem. `null` przy zerowym mianowniku —
 * „0%" sugerowałoby zmierzoną porażkę tam, gdzie nie ma jeszcze czego mierzyć.
 */
export function konwersjaZKatalogu(
  wejscia: readonly { metadata: unknown }[],
  klikniecia: number,
): { zZewnatrz: number; procent: number | null } {
  const zZewnatrz = wejscia.filter((w) => zrodloZdarzenia(w.metadata) !== 'wewnetrzne').length;
  return {
    zZewnatrz,
    procent: zZewnatrz > 0 ? Math.round((klikniecia / zZewnatrz) * 1000) / 10 : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AKTYWACJA — dwie liczby, od których zależy kolejność wszystkiego innego.
//
// Panel liczył dotąd WOLUMEN: „Mecze utworzone / 7 dni", „Dołączenia / 7 dni".
// Licznik wolumenu wygląda IDENTYCZNIE w dwóch stanach, które są przeciwieństwami:
// dziesięciu organizatorów po jednym meczu (teza biznesowa obalona) i jeden
// organizator z dziesięcioma (teza potwierdzona). Cała strategia stoi na zdaniu
// „organizator przyprowadza 10–14 osób" — a organizator, który zrobił jeden mecz
// i nie wrócił, nie przyprowadził nikogo, tylko jednorazową grupę bez powodu
// do powrotu.
//
// Te dwie funkcje są tym, czego `docs/rewizja-2026-08.md` („Czego nie wiem",
// pkt 1) zażądał w sierpniu i czego od tamtej pory nikt nie policzył, mimo że
// zdarzenia leżą w bazie od migracji `047`.
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum, jakiego wymagamy od zdarzenia przy liczeniu aktywacji. Celowo węższe
 *  niż wiersz z panelu: funkcje mają dać się wołać z testu bez budowania atrapy
 *  całego `Row`. */
export interface ZdarzenieDoAktywacji {
  user_id: string | null;
  event_type: string;
  created_at: string;
}

const DOBA_MS = 24 * 60 * 60 * 1000;

/** Mediana, nie średnia: jeden organizator, który wrócił po 29 dniach, przesuwa
 *  średnią o tydzień i każe czytać ją jako „ludzie wracają po tygodniu". */
function mediana(liczby: number[]): number | null {
  if (liczby.length === 0) return null;
  const s = [...liczby].sort((a, b) => a - b);
  const srodek = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[srodek] : Math.round((s[srodek - 1] + s[srodek]) / 2);
}

export interface PowtarzalnoscOrganizatora {
  /** Ilu różnych ludzi utworzyło w oknie co najmniej jeden mecz. */
  organizatorzy: number;
  /** Ilu z nich utworzyło co najmniej dwa. */
  zDrugimMeczem: number;
  /** `null` przy zerowym mianowniku: „0%" czytałoby się jak zmierzona porażka
   *  tam, gdzie nie ma jeszcze czego mierzyć (ta sama zasada co
   *  `konwersjaZKatalogu()` wyżej). */
  procent: number | null;
  /** Mediana odstępu pierwszy → drugi mecz, w pełnych dniach. */
  medianaDniDoDrugiego: number | null;
}

/**
 * Odsetek organizatorów, którzy wrócili po drugi mecz. **Definicja aktywacji
 * dla tego produktu.**
 *
 * OGRANICZENIE, KTÓREGO NIE DA SIĘ OBEJŚĆ PO STRONIE TEJ FUNKCJI: liczy wyłącznie
 * to, co dostanie. Panel podaje jej okno 30 dni, więc organizator z pierwszym
 * meczem sprzed 40 dni i drugim wczoraj policzy się jako „jeden mecz". Liczba jest
 * przez to DOLNYM oszacowaniem i panel musi to napisać przy niej — inaczej kłamie
 * w dół dokładnie wtedy, gdy produkt zaczyna działać.
 */
export function powtarzalnoscOrganizatora(
  zdarzenia: readonly ZdarzenieDoAktywacji[],
): PowtarzalnoscOrganizatora {
  const wgOrganizatora = new Map<string, number[]>();
  for (const z of zdarzenia) {
    if (z.event_type !== 'event_created' || !z.user_id) continue;
    const czas = new Date(z.created_at).getTime();
    // Zdarzenie z niesparsowalną datą wyrzucamy, zamiast wpuszczać `NaN`
    // do sortowania — tam przeszłoby po cichu i zepsuło medianę.
    if (!Number.isFinite(czas)) continue;
    const lista = wgOrganizatora.get(z.user_id) ?? [];
    lista.push(czas);
    wgOrganizatora.set(z.user_id, lista);
  }

  const odstepy: number[] = [];
  let zDrugimMeczem = 0;
  wgOrganizatora.forEach((czasy) => {
    if (czasy.length < 2) return;
    zDrugimMeczem += 1;
    // Panel oddaje wiersze malejąco po dacie, więc sortujemy u siebie zamiast
    // ufać kolejności wejścia: „pierwszy" ma znaczyć najwcześniejszy, nie
    // pierwszy napotkany.
    czasy.sort((a, b) => a - b);
    odstepy.push(Math.round((czasy[1] - czasy[0]) / DOBA_MS));
  });

  const organizatorzy = wgOrganizatora.size;
  return {
    organizatorzy,
    zDrugimMeczem,
    procent: organizatorzy > 0
      ? Math.round((zDrugimMeczem / organizatorzy) * 1000) / 10
      : null,
    medianaDniDoDrugiego: mediana(odstepy),
  };
}

export interface KonwersjaGoscia {
  zapisyGosci: number;
  przejecia: number;
  procent: number | null;
}

/**
 * Zapis bez konta → przejęcie wpisu kontem. Rozstrzyga tezę
 * [rewizji](../../docs/rewizja-2026-08.md) §2: czy Bojo jest NARZĘDZIEM (wzrost
 * liniowy, organizator po organizatorze) czy SIECIĄ (każdy gość może zostać
 * kolejnym organizatorem).
 *
 * LICZY ZDARZENIA, NIE LUDZI, i tego nie da się tu naprawić: `guest_joined`
 * powstaje, gdy nikt nie jest zalogowany, więc wiersz ma `user_id = NULL` i nie
 * ma po czym rozpoznać osoby. Jedna osoba zapisana na trzy mecze to trzy zapisy.
 * Iloraz jest więc PROPORCJĄ ZDARZEŃ, użyteczną jako trend i rząd wielkości,
 * a nie odsetkiem osób — panel ma to powiedzieć wprost, zamiast pokazywać
 * procent, który czyta się jak „tylu procent gości założyło konto".
 */
export function konwersjaGoscia(
  zdarzenia: readonly ZdarzenieDoAktywacji[],
): KonwersjaGoscia {
  let zapisyGosci = 0;
  let przejecia = 0;
  for (const z of zdarzenia) {
    if (z.event_type === 'guest_joined') zapisyGosci += 1;
    else if (z.event_type === 'guest_claimed') przejecia += 1;
  }
  return {
    zapisyGosci,
    przejecia,
    procent: zapisyGosci > 0 ? Math.round((przejecia / zapisyGosci) * 1000) / 10 : null,
  };
}
