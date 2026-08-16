import { test, expect, type Page } from '@playwright/test';

// Regresja wizualna: zrzut ekranu porównywany ze wzorcem w repo.
//
// PO CO, skoro są już testy klikalności: tamte pilnują, że da się kliknąć.
// Te pilnują, że widok NADAL WYGLĄDA tak samo. Złapią rzeczy, których nie
// widzi żadne inne narzędzie w repo: przesunięty przycisk, zniknięty badge,
// tekst wychodzący poza kartę, zmieniony kolor statusu.
//
// JAK SIĘ PRZEGLĄDA ZMIANY
// Wzorce leżą w `e2e/wzorce/` i idą do repo. Gdy widok się zmieni, test padnie,
// a PR pokaże różnicę obrazków — GitHub ma wbudowany podgląd „przed/po"
// z suwakiem, który działa też na telefonie. Jeśli zmiana jest zamierzona,
// nadaj PR-owi etykietę `zrzuty:zaakceptuj` — workflow wygeneruje nowe wzorce
// i dopisze je do gałęzi.
//
// ZAKRES TEGO PLIKU: **bez bazy danych**.
// Ten plik uruchamia się na atrapach kluczy Supabase, w tym samym przebiegu co
// build produkcyjny — nie potrzebuje Dockera ani lokalnego stosu. Komunikaty,
// które normalnie przychodzą z serwera (złe hasło, e-mail zajęty, limit prób),
// podstawiamy `page.route()`: przechwytujemy odpowiedź GoTrue i oddajemy tę,
// którą chcemy zobaczyć. Zrzut pokazuje wtedy PRAWDZIWY widok aplikacji na
// prawdziwej ścieżce kodu — atrapa jest tylko po stronie sieci.
//
// Widoki wymagające zalogowania i realnych danych (skład meczu, rezerwa,
// płatności) siedzą w `scenariusze.spec.ts` i chodzą na lokalnym Supabase.
//
// CZEGO NIE ROBIMY
// Nie robimy zrzutu całej strony tam, gdzie treść zależy od czasu („za 2 dni")
// albo od zewnętrznego serwisu (awatary, kafelki mapy). Takie miejsca albo
// maskujemy, albo zrzucamy sam fragment.

/** Wycisza wszystko, co rusza się samo — inaczej zrzut łapie kadr w połowie
 *  przejścia i test miga na czerwono bez powodu. */
async function uspokoj(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      /* Kursor w polach tekstowych miga. Playwright ma na to wlasne
         ustawienie, ale dziala tylko dla pola z aktywnym focusem. */
      * { caret-color: transparent !important; }
    `,
  });
  // Czcionki: zrzut zrobiony przed ich załadowaniem pokazuje zapasowy krój.
  await page.evaluate(() => document.fonts?.ready);
}

/** Baner cookies wyskakuje po 6 sekundach ALBO po przewinięciu 300 px
 *  (`lib/cookieConsent.ts`). Zrzut zrobiony na granicy tego czasu łapałby go
 *  raz tak, raz nie — więc domyślnie go zamykamy, a pokazujemy tylko w tym
 *  jednym teście, który jest o nim. */
async function bezBaneraCookies(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });
}

/** Pusta baza zamiast braku bazy.
 *
 *  Bez tego zapytania lecą na `placeholder.supabase.co`, a to, co zobaczy
 *  test, zależy od tego, jak szybko padnie DNS — czasem pusta lista, czasem
 *  wieczna kręciołka. Odpowiadając pustą tablicą dostajemy dokładnie ten stan,
 *  o który chodzi: widok „nic tu nie ma", zawsze taki sam. */
async function pustaBaza(page: Page) {
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

/** Podstawia odpowiedź GoTrue na logowanie hasłem. */
async function odpowiedzLogowania(page: Page, status: number, body: unknown) {
  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

/** Podstawia odpowiedź GoTrue na zakładanie konta. */
async function odpowiedzRejestracji(page: Page, status: number, body: unknown) {
  await page.route('**/auth/v1/signup**', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

/** Wypełnia i wysyła formularz logowania. */
async function zaloguj(page: Page, email = 'ktos@example.com', haslo = 'tajnehaslo123') {
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(haslo);
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).last().click();
}

/** Karta z formularzem — zrzucamy ją, a nie całą stronę, bo w tle leci
 *  podgląd listy meczów, który nie ma nic wspólnego z badanym komunikatem. */
function karta(page: Page) {
  return page.locator('form').first();
}

test.beforeEach(async ({ page }) => {
  await bezBaneraCookies(page);
});

/* ── Widoki publiczne ───────────────────────────────────────────────────── */

test.describe('widoki publiczne', () => {
  test('lista gier', async ({ page }) => {
    await page.goto('/wydarzenia');
    await uspokoj(page);
    // Sama rama widoku: pasek filtrów i układ. Kart meczów nie ma co
    // porównywać — bez bazy lista jest pusta, a z bazą zmienia się co dzień.
    await expect(page.locator('header').first()).toHaveScreenshot('lista-gier-naglowek.png');
  });

  test('lista gier — nic nie znaleziono', async ({ page }) => {
    await pustaBaza(page);
    await page.goto('/wydarzenia');
    // `filter({ visible: true })` nie jest ozdobnikiem: `/wydarzenia` renderuje
    // listę DWA razy — raz w gałęzi `hidden md:block` (komputer), raz w
    // `md:hidden` (telefon, z przełącznikiem lista/mapa). Bez filtru zwykłe
    // `.first()` trafia na kopię ukrytą przez CSS i test czeka na coś, co
    // w tym rozmiarze okna nigdy się nie pokaże.
    await expect(page.getByText('Brak meczów').filter({ visible: true }).first())
      .toBeVisible({ timeout: 20_000 });
    await uspokoj(page);
    await expect(page).toHaveScreenshot('lista-gier-pusto.png', { fullPage: true });
  });

  test('logowanie', async ({ page }) => {
    await page.goto('/logowanie');
    await uspokoj(page);
    await expect(page).toHaveScreenshot('logowanie.png', { fullPage: true });
  });

  test('rejestracja — podpowiedź o nazwisku', async ({ page }) => {
    await page.goto('/logowanie?mode=rejestracja');
    await uspokoj(page);
    const formularz = page.locator('form').first();
    if ((await formularz.count()) === 0) test.skip(true, 'brak formularza w tym widoku');
    await expect(formularz).toHaveScreenshot('rejestracja-formularz.png');
  });

  test('404 — nie ma takiej strony', async ({ page }) => {
    await page.goto('/takiej-strony-nie-ma');
    await expect(page.getByText('Nie znaleziono strony')).toBeVisible();
  });

  test('nie ma takiego meczu', async ({ page }) => {
    await pustaBaza(page);
    await page.goto('/wydarzenia/00000000-0000-4000-8000-000000000000');
    await expect(page.getByText('Nie znaleziono wydarzenia')).toBeVisible({ timeout: 20_000 });
  });

  test('baner o cookies', async ({ page, context }) => {
    // Jedyny test, w którym baner MA być widoczny — czyścimy zgodę wstawioną
    // w `beforeEach` i przewijamy o próg, który go wywołuje.
    await context.clearCookies();
    await page.addInitScript(() => {
      try { localStorage.removeItem('bojo_cookie_consent_v1'); } catch { /* tryb prywatny */ }
    });
    await page.goto('/');
    await page.mouse.wheel(0, 600);
    const baner = page.getByRole('dialog', { name: 'Informacja o cookies' });
    await expect(baner).toBeVisible({ timeout: 15_000 });
    await uspokoj(page);
    await expect(baner).toHaveScreenshot('baner-cookies.png');
  });
});

/* ── Ekrany, które bez konta proszą o zalogowanie ───────────────────────── */

test.describe('zachęta do zalogowania', () => {
  // Te trzy widoki to pierwszy kontakt z aplikacją dla kogoś, kto wszedł
  // z linku. Jeśli któryś zamiast zachęty pokaże pustkę albo kręciołkę,
  // człowiek odbija się od progu — a żaden inny test tego nie widzi.
  for (const [nazwa, adres, plik] of [
    ['moje gry', '/moje-gry', 'wylogowany-moje-gry.png'],
    ['grupy', '/grupy', 'wylogowany-grupy.png'],
    ['profil', '/profil', 'wylogowany-profil.png'],
  ] as const) {
    test(nazwa, async ({ page }) => {
      await pustaBaza(page);
      await page.goto(adres);
      // Czekamy na cokolwiek stabilnego zamiast na sam `load` — inaczej zrzut
      // łapie kręciołkę sprawdzania sesji.
      await page.waitForLoadState('networkidle');
      await uspokoj(page);
      await expect(page).toHaveScreenshot(plik, { fullPage: true });
    });
  }
});

/* ── Komunikaty walidacji (po stronie przeglądarki) ─────────────────────── */

test.describe('komunikaty walidacji', () => {
  // Sedno: komunikaty to miejsce, w którym najłatwiej o cichą regresję —
  // zmienia się tekst albo znika cała ramka i nikt tego nie zauważa.
  test('rejestracja odrzuca jednoczłonową nazwę', async ({ page }) => {
    await page.goto('/logowanie?mode=rejestracja');
    await uspokoj(page);

    const imie = page.getByPlaceholder('Imię i nazwisko');
    if ((await imie.count()) === 0) test.skip(true, 'brak pola imienia — inny wariant formularza');

    await imie.fill('Jan');
    await page.locator('input[type="email"]').first().fill('ktos@example.com');
    await page.locator('input[type="password"]').first().fill('tajnehaslo123');
    await page.getByRole('button', { name: /załóż konto/i }).click();

    const blad = page.getByText(/podaj imię i nazwisko/i);
    await expect(blad).toBeVisible();
    await expect(page.locator('form').first()).toHaveScreenshot('rejestracja-blad-nazwy.png');
  });

  test('rejestracja przyjmuje nazwisko z inicjału', async ({ page }) => {
    await page.goto('/logowanie?mode=rejestracja');
    await uspokoj(page);

    const imie = page.getByPlaceholder('Imię i nazwisko');
    if ((await imie.count()) === 0) test.skip(true, 'brak pola imienia — inny wariant formularza');

    await imie.fill('Krzysiek W');
    // Nie klikamy „Załóż konto" — bez bazy i tak nie ma czego zakładać.
    // Sprawdzamy to, co widzi człowiek: pole nie jest oznaczone jako błędne.
    await expect(page.getByText(/podaj imię i nazwisko/i)).toHaveCount(0);
  });
});

/* ── Komunikaty z serwera logowania ─────────────────────────────────────── */

test.describe('komunikaty logowania', () => {
  // Wszystkie przechodzą przez `mapAuthError()` w `lib/auth.tsx`: GoTrue mówi
  // po angielsku, użytkownik ma zobaczyć polski komunikat. Ten przekład jest
  // najłatwiejszy do zepsucia — wystarczy, że Supabase zmieni brzmienie błędu,
  // i zamiast „Nieprawidłowy e-mail lub hasło" wychodzi surowe angielskie
  // zdanie. Zrzut pokazuje to od razu.

  test('złe hasło', async ({ page }) => {
    await odpowiedzLogowania(page, 400, {
      error: 'invalid_grant',
      error_description: 'Invalid login credentials',
      message: 'Invalid login credentials',
      code: 'invalid_credentials',
    });
    await page.goto('/logowanie');
    await uspokoj(page);
    await zaloguj(page);
    await expect(page.getByText('Nieprawidłowy e-mail lub hasło.')).toBeVisible();
    await expect(karta(page)).toHaveScreenshot('logowanie-zle-haslo.png');
  });

  test('e-mail niepotwierdzony', async ({ page }) => {
    await odpowiedzLogowania(page, 400, {
      error: 'invalid_grant',
      error_description: 'Email not confirmed',
      message: 'Email not confirmed',
      code: 'email_not_confirmed',
    });
    await page.goto('/logowanie');
    await uspokoj(page);
    await zaloguj(page);
    await expect(page.getByText(/potwierdź e-mail, zanim się zalogujesz/i)).toBeVisible();
    await expect(karta(page)).toHaveScreenshot('logowanie-mail-niepotwierdzony.png');
  });

  test('za dużo prób', async ({ page }) => {
    await odpowiedzLogowania(page, 429, {
      error: 'over_request_rate_limit',
      message: 'Request rate limit reached',
      code: 'over_request_rate_limit',
    });
    await page.goto('/logowanie');
    await uspokoj(page);
    await zaloguj(page);
    await expect(page.getByText(/za dużo prób/i)).toBeVisible();
    await expect(karta(page)).toHaveScreenshot('logowanie-limit-prob.png');
  });
});

/* ── Komunikaty przy zakładaniu konta ───────────────────────────────────── */

test.describe('komunikaty rejestracji', () => {
  async function wypelnijRejestracje(page: Page) {
    await page.getByPlaceholder('Imię i nazwisko').fill('Krzysiek W');
    await page.locator('input[type="email"]').first().fill('ktos@example.com');
    await page.locator('input[type="password"]').first().fill('tajnehaslo123');
    await page.getByRole('button', { name: /załóż konto/i }).click();
  }

  test('e-mail już zajęty — odpowiedź wprost', async ({ page }) => {
    await odpowiedzRejestracji(page, 400, {
      message: 'User already registered',
      code: 'user_already_exists',
    });
    await page.goto('/logowanie?mode=rejestracja');
    await uspokoj(page);
    await wypelnijRejestracje(page);
    await expect(page.getByText(/konto z tym adresem już istnieje/i)).toBeVisible();
    await expect(karta(page)).toHaveScreenshot('rejestracja-mail-zajety.png');
  });

  test('e-mail już zajęty — przy ochronie przed enumeracją', async ({ page }) => {
    // Supabase z włączoną ochroną przed enumeracją e-maili NIE zgłasza błędu:
    // oddaje fałszywy sukces z pustą tablicą `identities`. Bez rozpoznania tego
    // przypadku (`lib/auth.tsx`) aplikacja pokazywałaby „sprawdź pocztę" komuś,
    // kto konto ma od dawna i żadnego maila nie dostanie.
    await odpowiedzRejestracji(page, 200, {
      id: '00000000-0000-4000-8000-000000000000',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'ktos@example.com',
      identities: [],
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2020-01-01T00:00:00Z',
    });
    await page.goto('/logowanie?mode=rejestracja');
    await uspokoj(page);
    await wypelnijRejestracje(page);
    await expect(page.getByText(/konto z tym adresem już istnieje/i)).toBeVisible();
    await expect(karta(page)).toHaveScreenshot('rejestracja-mail-zajety-cichy.png');
  });

  test('konto założone — sprawdź pocztę', async ({ page }) => {
    await odpowiedzRejestracji(page, 200, {
      id: '11111111-1111-4111-8111-111111111111',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'ktos@example.com',
      identities: [{ id: 'x', user_id: '11111111-1111-4111-8111-111111111111', provider: 'email' }],
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2020-01-01T00:00:00Z',
    });
    await page.goto('/logowanie?mode=rejestracja');
    await uspokoj(page);
    await wypelnijRejestracje(page);
    await expect(page.getByText('Sprawdź pocztę')).toBeVisible();
    // Tu formularza już nie ma — cała karta zamienia się w ekran potwierdzenia.
    await expect(page.locator('main')).toHaveScreenshot('rejestracja-sprawdz-poczte.png');
  });

  test('rejestracja wyłączona', async ({ page }) => {
    await odpowiedzRejestracji(page, 422, {
      message: 'Signups not allowed for this instance',
      code: 'signup_disabled',
    });
    await page.goto('/logowanie?mode=rejestracja');
    await uspokoj(page);
    await wypelnijRejestracje(page);
    await expect(page.getByText(/rejestracja jest chwilowo wyłączona/i)).toBeVisible();
    await expect(karta(page)).toHaveScreenshot('rejestracja-wylaczona.png');
  });
});

/* ── Logowanie linkiem i reset hasła ────────────────────────────────────── */

test.describe('logowanie bez hasła i reset', () => {
  test('formularz logowania linkiem', async ({ page }) => {
    await page.goto('/logowanie');
    await uspokoj(page);
    await page.getByRole('button', { name: /zaloguj się linkiem/i }).click();
    await expect(page.getByRole('heading', { name: 'Logowanie linkiem' })).toBeVisible();
    await expect(karta(page)).toHaveScreenshot('logowanie-linkiem-formularz.png');
  });

  test('link wysłany', async ({ page }) => {
    await page.route('**/auth/v1/otp**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/logowanie');
    await uspokoj(page);
    await page.getByRole('button', { name: /zaloguj się linkiem/i }).click();
    await page.locator('input[type="email"]').first().fill('ktos@example.com');
    await page.getByRole('button', { name: /wyślij link logowania/i }).click();
    await expect(page.getByText('Sprawdź pocztę')).toBeVisible();
    await expect(page.locator('main')).toHaveScreenshot('logowanie-linkiem-wyslany.png');
  });

  test('formularz resetu hasła', async ({ page }) => {
    await page.goto('/logowanie');
    await uspokoj(page);
    await page.getByRole('button', { name: /nie pamiętasz hasła/i }).click();
    await expect(page.getByRole('heading', { name: 'Reset hasła' })).toBeVisible();
    await expect(karta(page)).toHaveScreenshot('reset-hasla-formularz.png');
  });

  test('reset hasła wysłany', async ({ page }) => {
    await page.route('**/auth/v1/recover**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/logowanie');
    await uspokoj(page);
    await page.getByRole('button', { name: /nie pamiętasz hasła/i }).click();
    await page.locator('input[type="email"]').first().fill('ktos@example.com');
    await page.getByRole('button', { name: /wyślij link resetu/i }).click();
    await expect(page.getByText('Sprawdź pocztę')).toBeVisible();
    await expect(page.locator('main')).toHaveScreenshot('reset-hasla-wyslany.png');
  });
});

/* ── Przeglądarka wbudowana w Facebooka / Instagrama ────────────────────── */

test.describe('przeglądarka w aplikacji', () => {
  // Realny przypadek: link do meczu wysłany na Messengerze otwiera się
  // w WebView, w którym Google blokuje logowanie. Aplikacja rozpoznaje to po
  // `User-Agent` i zamiast martwego przycisku pokazuje instrukcję. Widok jest
  // niedostępny w zwykłej przeglądarce, więc bez podstawionego UA nikt go
  // nigdy nie zobaczy — łatwo zepsuć niepostrzeżenie.
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
      + '(KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.0;FBDV/iPhone14,3]',
  });

  test('Google zablokowane — instrukcja zamiast martwego przycisku', async ({ page }) => {
    await page.goto('/logowanie');
    await uspokoj(page);
    await expect(page.getByText('Google jest zablokowane w tej przeglądarce')).toBeVisible();
    await expect(page.locator('main')).toHaveScreenshot('logowanie-webview-facebook.png');
  });
});

/* ── Mapa ───────────────────────────────────────────────────────────────── */

test.describe('mapa', () => {
  test('rama widoku mapy', async ({ page }) => {
    await page.goto('/mapa');
    await uspokoj(page);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
    // Kafelki mapy przychodzą z zewnętrznego serwera i różnią się między
    // przebiegami — maskujemy je, zostaje nasza nakładka: pasek, pigułki filtrów.
    await expect(page).toHaveScreenshot('mapa.png', {
      mask: [page.locator('.leaflet-tile-pane')],
    });
  });
});

/* ── Przemiał po wszystkich trasach ─────────────────────────────────────── */

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
const TRASY: Array<[nazwa: string, adres: string]> = [
  ['strona-glowna',        '/'],
  ['dlaczego-bojo',        '/dlaczego-bojo'],
  ['jak-dziala-bojo',      '/jak-dziala-bojo'],
  ['faq',                  '/faq'],
  ['regulamin',            '/regulamin'],
  ['prywatnosc',           '/prywatnosc'],
  ['logowanie',            '/logowanie'],
  ['wydarzenia',           '/wydarzenia'],
  ['wydarzenia-nowe',      '/wydarzenia/nowe'],
  ['wydarzenie-nieznane',  '/wydarzenia/00000000-0000-4000-8000-000000000000'],
  ['moje-gry',             '/moje-gry'],
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
  ['turniej',              '/turniej'],
  ['turniej-drabinka',     '/turniej/drabinka'],
  ['turniej-rejestracja',  '/turniej/rejestracja'],
  ['zaproszenie-do-gry',   '/d/NIEISTNIEJE'],
  ['zaproszenie-do-grupy', '/g/NIEISTNIEJE'],
  ['nie-ma-strony',        '/takiej-strony-nie-ma'],
];

test.describe('wszystkie trasy', () => {
  for (const [nazwa, adres] of TRASY) {
    test(nazwa, async ({ page }) => {
      await pustaBaza(page);
      await page.goto(adres);
      // `networkidle` zamiast `load`: część tras dociąga dane po zamontowaniu,
      // a zrzut zrobiony wcześniej łapie kręciołkę zamiast widoku.
      await page.waitForLoadState('networkidle');
      await uspokoj(page);
      await expect(page).toHaveScreenshot(`trasa-${nazwa}.png`, {
        fullPage: true,
        // Liczniki z katalogu boisk rosną z każdym importem i nie o nie tu chodzi.
        mask: [page.locator('[data-zrzut-maskuj]')],
      });
    });
  }
});

/* ── PWA: instalowalność ────────────────────────────────────────────────── */

test.describe('instalowalna apka', () => {
  // Tego nie widać na żadnym zrzucie, a psuje się cicho: dość podmienić
  // ścieżkę ikony albo wywalić rejestrację workera, żeby „dodaj do ekranu
  // głównego" znowu robiło zwykły skrót w przeglądarce. Zauważyłby to dopiero
  // ktoś instalujący aplikację — czyli nikt, bo instaluje się raz.

  test('manifest jest serwowany i ma komplet ikon', async ({ page, request }) => {
    await page.goto('/');
    const odnosnik = page.locator('link[rel="manifest"]');
    await expect(odnosnik).toHaveCount(1);

    const adres = await odnosnik.getAttribute('href');
    const odpowiedz = await request.get(adres!);
    expect(odpowiedz.ok(), `manifest zwrócił ${odpowiedz.status()}`).toBe(true);

    const manifest = await odpowiedz.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(4);

    // Każda ikona z manifestu musi się realnie pobierać. Literówka w ścieżce
    // nie wywala buildu — kończy się cichym brakiem ikony po instalacji.
    for (const ikona of manifest.icons) {
      const plik = await request.get(ikona.src);
      expect(plik.ok(), `ikona ${ikona.src} zwróciła ${plik.status()}`).toBe(true);
    }
  });

  test('apple-touch-icon jest w <head> — iOS nie czyta manifestu', async ({ page, request }) => {
    await page.goto('/');
    const odnosnik = page.locator('link[rel="apple-touch-icon"]');
    await expect(odnosnik).toHaveCount(1);
    const plik = await request.get((await odnosnik.getAttribute('href'))!);
    expect(plik.ok()).toBe(true);
  });

  test('service worker się rejestruje', async ({ page }) => {
    await page.goto('/');
    // Rejestracja startuje dopiero po zdarzeniu `load`, a `register()` jest
    // asynchroniczne — pojedyncze sprawdzenie zaraz po `load` trafia w moment,
    // w którym workera jeszcze nie ma. Stąd odpytywanie do skutku zamiast
    // jednego strzału.
    await expect.poll(
      () => page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return 'brak API';
        const rejestracja = await navigator.serviceWorker.getRegistration();
        return rejestracja ? 'jest' : 'brak rejestracji';
      }),
      { timeout: 15_000 },
    ).toBe('jest');
  });
});
