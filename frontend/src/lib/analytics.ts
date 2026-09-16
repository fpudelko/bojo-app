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
  | 'boisko_pobliskie';

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
