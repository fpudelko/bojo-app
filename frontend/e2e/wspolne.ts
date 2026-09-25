import type { Page } from '@playwright/test';

/**
 * Wspólne dla testów, które chodzą BEZ BAZY (na atrapach kluczy): lista tras
 * i atrapa pustej bazy. Wyjęte z `wizualne.spec.ts`, bo tych samych tras
 * używa `hydracja.klikalnosc.spec.ts` — dwie kopie listy rozjechałyby się przy
 * pierwszej nowej trasie. Zasada z AGENTS.md zostaje jedna: dodajesz trasę
 * w `src/app` → dopisz ją do `TRASY` tutaj.
 */

/** Pusta baza zamiast braku bazy.
 *
 *  Bez tego zapytania lecą na `placeholder.supabase.co`, a to, co zobaczy
 *  test, zależy od tego, jak szybko padnie DNS — czasem pusta lista, czasem
 *  wieczna kręciołka. Odpowiadając pustą tablicą dostajemy dokładnie ten stan,
 *  o który chodzi: widok „nic tu nie ma", zawsze taki sam. */
export async function pustaBaza(page: Page) {
  await page.route('**/rest/v1/**', (route) => {
    // Zapytanie z `.single()` / `.maybeSingle()` wysyła nagłówek
    // `Accept: application/vnd.pgrst.object+json` i PostgREST oddaje mu wtedy
    // OBIEKT, a przy zerze wierszy — błąd 406 PGRST116. Pusta tablica w tym
    // miejscu jest gorsza niż brak odpowiedzi: supabase-js bierze ją za wiersz
    // i strona meczu rysuje nagłówek „undefined" oraz „Zostało NaN miejsc".
    // Atrapa musi kłamać tak, jak kłamie prawdziwy serwer.
    const accept = route.request().headers()['accept'] ?? '';
    if (accept.includes('pgrst.object')) {
      return route.fulfill({
        status: 406,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'PGRST116',
          details: 'The result contains 0 rows',
          hint: null,
          message: 'JSON object requested, multiple (or no) rows returned',
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      body: '[]',
    });
  });
}

// Powód istnienia: pojedyncze scenariusze pilnują miejsc, o których ktoś
// pomyślał. Ta lista pilnuje CAŁEJ aplikacji — każdej trasy, którą da się
// otworzyć bez bazy. Dzięki temu zmiana w nagłówku, stopce, kolorach czy
// odstępach pokazuje się wszędzie tam, gdzie realnie ją widać, a nie tylko
// na czterech ekranach, które akurat mają własny test.
//
// Trasy dynamiczne dostają wymyślone identyfikatory — przy pustej bazie
// wychodzi z tego stan „nie ma takiego obiektu", też wart pilnowania.
//
// Czego tu NIE MA: `/mapa` (ma własny test z maskowaniem kafelków) oraz
// `/auth/*` (przekierowania techniczne, nie widoki).
export const TRASY: Array<[nazwa: string, adres: string]> = [
  ['strona-glowna',        '/'],
  ['dlaczego-bojo',        '/dlaczego-bojo'],
  ['jak-dziala-bojo',      '/jak-dziala-bojo'],
  ['o-bojo',               '/o-bojo'],
  ['faq',                  '/faq'],
  ['regulamin',            '/regulamin'],
  ['prywatnosc',           '/prywatnosc'],
  ['logowanie',            '/logowanie'],
  ['wydarzenia',           '/wydarzenia'],
  ['wydarzenia-nowe',      '/wydarzenia/nowe'],
  ['wydarzenie-nieznane',  '/wydarzenia/00000000-0000-4000-8000-000000000000'],
  ['moje-gry',             '/moje-gry'],
  ['rozmowy',              '/rozmowy'],
  ['rozmowa-prywatna',     '/rozmowy/00000000-0000-4000-8000-000000000000'],
  ['rozmowa-ekipy',        '/rozmowy/grupa/00000000-0000-4000-8000-000000000000'],
  ['rozmowa-meczu',        '/rozmowy/mecz/00000000-0000-4000-8000-000000000000'],
  ['grupy',                '/grupy'],
  ['grupy-nowe',           '/grupy/nowe'],
  ['grupa-nieznana',       '/grupy/00000000-0000-4000-8000-000000000000'],
  ['profil',               '/profil'],
  ['cykliczne',            '/cykliczne'],
  ['cykliczne-nowe',       '/cykliczne/nowe'],
  ['rezerwacje',           '/rezerwacje'],
  ['obiekt',               '/obiekt'],
  ['obiekt-nowy',          '/obiekt/nowe'],
  ['obiekt-nieznany',      '/obiekt/00000000-0000-4000-8000-000000000000'],
  ['boiska-pilka-nozna',   '/boiska/pilka-nozna'],
  ['boisko-nieznane',      '/boisko/nie-ma-takiego-boiska'],
  ['gracz-nieznany',       '/gracz/00000000-0000-4000-8000-000000000000'],
  // `/alert/wylacz/[token]` ŚWIADOMIE TU NIE MA, mimo zasady „dodajesz trasę
  // w src/app → dopisz ją do TRASY". Ta strona wykonuje zapytanie od razu po
  // wejściu i pokazuje jeden z trzech stanów zależnie od wyniku, a ten
  // przemiał robi `goto` + zrzut bez czekania na cokolwiek. Zrzut łapałby raz
  // „Wyłączam…", raz stan końcowy — czyli meldowałby zmianę wyglądu przy
  // każdym przebiegu, niezależnie od tego, czy ktokolwiek coś zmienił. To ten
  // sam rodzaj gnijącego wzorca co daty z seeda (patrz AGENTS.md).
  ['turnieje',             '/turnieje'],
  ['turnieje-nowe',        '/turnieje/nowe'],
  ['turniej-nieznany',     '/turnieje/00000000-0000-4000-8000-000000000000'],
  ['turniej-zglos',        '/turnieje/00000000-0000-4000-8000-000000000000/zglos'],
  ['turniej-panel',        '/turnieje/00000000-0000-4000-8000-000000000000/panel'],
  ['dolacz-do-druzyny',    '/t/NIEISTNIEJE'],
  ['zaproszenie-do-gry',   '/d/NIEISTNIEJE'],
  ['zaproszenie-do-grupy', '/g/NIEISTNIEJE'],
  ['sport-miasto-poznan',  '/pilka-nozna/poznan'],
  ['sport-miasto-warszawa', '/koszykowka/warszawa'],
  ['nie-ma-strony',        '/takiej-strony-nie-ma'],
];
