import { test, expect, type Page } from '@playwright/test';

// Scenariusze ZA LOGOWANIEM — przejścia, które robi realny gracz, na realnej
// bazie (lokalny stos Supabase z `scripts/stos-lokalny.sh`).
//
// To jest ta część, która faktycznie ogranicza ryzyko regresji: wszystkie
// błędy tej sesji — komunikat „Dołączyłeś do meczu!" dla kogoś na rezerwie,
// obserwujący pokazywany jako rezerwowy, przycisk pod paskiem nawigacji,
// trzynasty gracz odbijający się od zarezerwowanych miejsc — mieszkały
// dokładnie tutaj i żaden test jednostkowy nie miał jak ich zobaczyć.
//
// Dane pochodzą z `supabase/seed_wizualne.sql` i mają stałe ODSTĘPY od dnia
// uruchomienia (dziś + 3, + 4 …), więc etykiety względne wychodzą powtarzalnie.
//
// Zegara NIE zamrażamy. Pierwsza wersja robiła to przez `page.clock` przy
// datach na sztywno w 2030 roku — i wszystkie 17 scenariuszy padło, bo GoTrue
// wystawia token ważny godzinę od PRAWDZIWEGO „teraz", a przeglądarka z zegarem
// w 2030 uznawała go za wygasły i wylogowywała użytkownika.
//
// Skutek uboczny: same daty w interfejsie zmieniają się z dnia na dzień.
// Dlatego zrzuty obejmują FRAGMENTY bez daty (licznik, okno zapisu, kolejka),
// a nie całą stronę. Ochrona przed regresją siedzi w asercjach zachowania —
// zrzut dokłada do tego układ i kolory.

const KONTA = {
  organizator: { email: 'test1@example.com', haslo: 'test1234' },
  gracz:       { email: 'test6@example.com', haslo: 'test1234' },
  drugiGracz:  { email: 'test7@example.com', haslo: 'test1234' },
};

const MECZ = {
  wolneMiejsca:   '11111111-1111-4111-8111-111111111111',
  komplet:        '22222222-2222-4222-8222-222222222222',
  rezerwacjaBr:   '33333333-3333-4333-8333-333333333333',
  wspolnaPula:    '44444444-4444-4444-8444-444444444444',
  doAkceptacji:   '55555555-5555-4555-8555-555555555555',
  kolejka:        '66666666-6666-4666-8666-666666666666',
  platny:         '77777777-7777-4777-8777-777777777777',
  odwolany:       '88888888-8888-4888-8888-888888888888',
  prywatny:       '99999999-9999-4999-8999-999999999999',
  zagrany:        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

/** Treść strony, BEZ chmurki powiadomienia.
 *
 *  Aplikacja pokazuje ten sam komunikat w dwóch miejscach: na karcie w treści
 *  i w chmurce na dole ekranu. `getByText()` bez zawężenia trafia w oba i
 *  Playwright przerywa na „strict mode violation" — co wygląda jak błąd
 *  aplikacji, a jest tylko nieprecyzyjnym pytaniem. Chmurka renderuje się poza
 *  `<main>` (w `lib/toast.tsx`, przy samym providerze), więc to jest granica,
 *  której szukamy. */
function tresc(page: Page) {
  return page.locator('main');
}

/** Chmurka powiadomienia — osobno, bo jej treść też chcemy sprawdzać.
 *  `role="status"` nadaje jej `lib/toast.tsx`. */
function chmurka(page: Page) {
  return page.getByRole('status');
}

async function uspokoj(page: Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important; animation-delay: 0s !important;
      transition-duration: 0s !important; transition-delay: 0s !important;
    }
    * { caret-color: transparent !important; }`,
  });
  await page.evaluate(() => document.fonts?.ready);
}

/** Logowanie przez formularz, nie przez podłożenie tokenu — chodzi o to, żeby
 *  przejść tę samą drogą co człowiek. Gdyby logowanie się zepsuło, mamy to
 *  wiedzieć tutaj, a nie dowiadywać się z pominiętych testów. */
async function zaloguj(page: Page, konto: { email: string; haslo: string }) {
  await page.goto('/logowanie');
  await page.locator('input[type="email"]').first().fill(konto.email);
  await page.locator('input[type="password"]').first().fill(konto.haslo);
  await page.getByRole('button', { name: /zaloguj/i }).first().click();
  await page.waitForURL((url) => !url.pathname.startsWith('/logowanie'), { timeout: 20_000 });

  // Sama zmiana adresu nie dowodzi, że sesja żyje — dzwonek powiadomień
  // renderuje się WYŁĄCZNIE zalogowanemu. Bez tego sprawdzenia zepsute
  // logowanie objawiało się dopiero jako „nie ma przycisku Dołącz" kilka
  // linijek dalej, w zupełnie niewinnym teście.
  try {
    await expect(page.getByRole('button', { name: /powiadomienia/i }).first())
      .toBeVisible({ timeout: 15_000 });
  } catch (e) {
    const widok = await page.evaluate(() => document.body.innerText.slice(0, 400));
    throw new Error(
      `Logowanie nie dało sesji (brak dzwonka powiadomień).\n`
      + `Adres: ${page.url()}\nCo widać:\n---\n${widok}\n---`,
    );
  }

  // Okno „Zanim zaczniesz — kim jesteś?" (`PostSignupRoleModal`) wyskakuje
  // świeżo założonym kontom i przykrywa całą stronę. Konta testowe są w bazie
  // od chwili seeda, więc dla przeglądarki wyglądają na świeże. Odklikujemy je
  // znacznikiem, którego używa sam komponent — zamiast klikać w okno, bo klik
  // wybrałby rolę i zmienił stan, o którym test nic nie wie.
  await page.evaluate(() => {
    const raw = Object.keys(localStorage).find((k) => k.startsWith('sb-'));
    try {
      const uid = raw ? JSON.parse(localStorage.getItem(raw)!)?.user?.id : null;
      if (uid) localStorage.setItem(`bojo:onboarding-rola:${uid}`, '1');
    } catch { /* brak sesji w localStorage — okno i tak się nie pokaże */ }
  });
}

/**
 * Otwiera stronę meczu i UPEWNIA SIĘ, że dane doszły.
 *
 * Powód istnienia: przez pięć przebiegów w CI wszystkie scenariusze padały
 * na „nie ma przycisku Dołącz", co jest objawem, nie przyczyną. Log z Actions
 * widać tylko od końca, więc diagnostyka wypisana na początku zadania była
 * nieosiągalna. Ten helper wkleja to, co REALNIE widzi przeglądarka, wprost
 * w treść błędu — a błędy Playwright drukuje na końcu logu.
 */
async function otworzMecz(page: Page, id: string) {
  await page.goto(`/wydarzenia/${id}`);
  const licznik = page.locator('text=/\\d+ \\/ \\d+/').first();
  try {
    await expect(licznik).toBeVisible({ timeout: 15_000 });
  } catch (e) {
    const widok = await page.evaluate(() => document.body.innerText.slice(0, 400));
    // Kluczowe rozróżnienie: czy meczu NIE MA w bazie, czy jest, ale
    // aplikacja go nie widzi. Pytamy API wprost, z tej samej przeglądarki.
    // `process.env` nie istnieje w przeglądarce — adres i klucz przekazujemy
    // z procesu testu (Node), gdzie zmienne z GITHUB_ENV są dostępne.
    const zApi = await page.evaluate(async ({ mecz, url, key }) => {
      if (!url || !key) return 'brak NEXT_PUBLIC_SUPABASE_* w procesie testu';
      try {
        const r = await fetch(
          `${url}/rest/v1/events?id=eq.${mecz}&select=id,title,visibility`,
          { headers: { apikey: key, Authorization: `Bearer ${key}` } },
        );
        return `${r.status} ${(await r.text()).slice(0, 200)}`;
      } catch (err) {
        return `fetch padł: ${(err as Error).message}`;
      }
    }, {
      mecz: id,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
    throw new Error(
      `Strona meczu nie pokazała licznika miejsc.\n`
      + `Adres: ${page.url()}\n`
      + `API dla tego meczu: ${zApi}\n`
      + `Co widać na stronie:\n---\n${widok}\n---`,
    );
  }
}

test.describe('dołączanie do meczu', () => {
  test('wolne miejsca — wchodzi do składu i komunikat to potwierdza', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.wolneMiejsca);
    await uspokoj(page);

    const licznik = page.getByText('2 / 10').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(licznik).toBeVisible();
    await expect(licznik).toHaveScreenshot('licznik-przed-dolaczeniem.png');

    await page.getByRole('button', { name: /^Dołącz/ }).first().click();
    await page.getByRole('button', { name: /zapisz mnie/i }).click();

    // Sedno: komunikat mówi o SKŁADZIE, nie o rezerwie.
    await expect(chmurka(page).getByText(/dołączyłeś do meczu/i)).toBeVisible();
    await expect(tresc(page).getByText('3 / 10')).toBeVisible();
    await uspokoj(page);
    const po = tresc(page).getByText('3 / 10')
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(po).toHaveScreenshot('licznik-po-dolaczeniu.png');
  });

  test('komplet — komunikat mówi WPROST o rezerwie', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.komplet);
    await uspokoj(page);

    await page.getByRole('button', { name: /komplet — zapisz się na rezerwę/i }).click();
    await page.getByRole('button', { name: /zapisz mnie/i }).click();

    // Regresja z tej sesji: mówiło „Dołączyłeś do meczu!" komuś na rezerwie.
    // Sprawdzamy OBA miejsca, w których to zdanie pada — chmurka i karta
    // rozjeżdżały się już wcześniej i każde z nich może się zepsuć osobno.
    await expect(chmurka(page).getByText(/liście rezerwowej/i)).toBeVisible();
    const karta = tresc(page).getByText(/jesteś na liście rezerwowej/i)
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(karta).toBeVisible();
    await expect(tresc(page).getByText(/nie masz miejsca w składzie/i)).toBeVisible();
    await uspokoj(page);
    await expect(karta).toHaveScreenshot('karta-rezerwy.png');
  });
});

test.describe('miejsca dla bramkarzy — dwa tryby obok siebie', () => {
  // Ta para to całe zgłoszenie o „trzynastym graczu": ten sam skład,
  // przeciwny wynik, różnica wyłącznie w trybie miejsc.
  test('rezerwacja — zawodnik z pola dostaje ostrzeżenie przed zapisem', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.rezerwacjaBr);
    await uspokoj(page);

    const licznik = page.getByText(/pole: komplet/i)
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(licznik).toBeVisible();
    await expect(licznik).toHaveScreenshot('bramkarze-rezerwacja-licznik.png');

    await page.getByRole('button', { name: /^Dołącz/ }).first().click();
    await expect(page.getByText(/w polu jest już komplet/i)).toBeVisible();
    await expect(page.getByText(/listę rezerwową/i)).toBeVisible();
    await uspokoj(page);
    await expect(page.getByRole('dialog').or(page.locator('.fixed.inset-0').last()))
      .toHaveScreenshot('bramkarze-rezerwacja-okno.png');
  });

  test('wspólna pula — ten sam skład, zawodnik wchodzi bez ostrzeżenia', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.wspolnaPula);
    await uspokoj(page);

    const licznik = page.getByText(/dla wszystkich ról/i)
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(licznik).toBeVisible();
    await expect(licznik).toHaveScreenshot('bramkarze-wspolna-licznik.png');

    await page.getByRole('button', { name: /^Dołącz/ }).first().click();
    await expect(page.getByText(/w polu jest już komplet/i)).toHaveCount(0);
  });
});

test.describe('organizator', () => {
  test('prośby o akceptację — sekcja na /moje-gry i decyzja na meczu', async ({ page }) => {
    await zaloguj(page, KONTA.organizator);

    await page.goto('/moje-gry');
    await uspokoj(page);
    await expect(page.getByText(/czekają na twoją decyzję/i)).toBeVisible();

    await otworzMecz(page, MECZ.doAkceptacji);
    await uspokoj(page);
    // Sekcja próśb — bez dat, więc nadaje się na wzorzec.
    const prosby = page.getByText(/czeka na akceptację|prośby o dołączenie/i).first()
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(prosby).toHaveScreenshot('prosby-organizator.png');
  });

  test('kolejka rezerwowa z przyciskiem „Do składu"', async ({ page }) => {
    await zaloguj(page, KONTA.organizator);
    await otworzMecz(page, MECZ.kolejka);
    await uspokoj(page);

    await expect(page.getByText(/rezerwa — kolejka/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /do składu/i }).first()).toBeVisible();
    const kolejka = page.getByText(/rezerwa — kolejka/i)
      .locator('xpath=ancestor::div[1]');
    await expect(kolejka).toHaveScreenshot('kolejka-organizator.png');
  });
});

test.describe('płatności', () => {
  test('bez wyboru metody nie da się zapisać', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.platny);
    await uspokoj(page);

    await page.getByRole('button', { name: /^Dołącz/ }).first().click();
    const zapisz = page.getByRole('button', { name: /zapisz mnie/i });
    await expect(zapisz).toBeDisabled();
    await expect(page.getByText(/wybierz sposób płatności/i)).toBeVisible();

    await page.getByRole('button', { name: /^BLIK$/i }).click();
    await expect(zapisz).toBeEnabled();
  });
});

test.describe('obserwowanie', () => {
  test('obserwujący nie trafia na listę rezerwową', async ({ page }) => {
    await zaloguj(page, KONTA.drugiGracz);
    await otworzMecz(page, MECZ.wolneMiejsca);
    await uspokoj(page);

    await page.getByRole('button', { name: /^Obserwuj$/i }).click();
    await expect(chmurka(page).getByText(/obserwujesz ten mecz/i)).toBeVisible();
    await expect(tresc(page).getByText('Obserwujesz ten mecz', { exact: true })).toBeVisible();

    // Regresja z tej sesji: obserwujący siedzi w bazie z `is_reserve = true`
    // i przez to pokazywał się w kolejce rezerwowej.
    await expect(tresc(page).getByText(/rezerwa — kolejka/i)).toHaveCount(0);
  });
});

test.describe('okna na telefonie', () => {
  test('okno wypisania jest nad paskiem nawigacji i da się kliknąć', async ({ page }, info) => {
    test.skip(!info.project.name.includes('telefon'), 'dotyczy tylko widoku telefonu');

    await zaloguj(page, KONTA.organizator);
    await otworzMecz(page, MECZ.wolneMiejsca);
    await uspokoj(page);

    await page.getByRole('button', { name: /wypisz się z meczu/i }).click();
    // Gdyby okno siedziało pod paskiem, Playwright zgłosi „intercepts pointer
    // events" właśnie tutaj — to jest test na tę konkretną regresję.
    const potwierdz = page.getByRole('button', { name: /wypisz mnie/i });
    await expect(potwierdz).toBeVisible();
    // Klikalność potwierdzenia to sedno tej regresji: gdyby okno siedziało pod
    // paskiem nawigacji, Playwright zgłosiłby „intercepts pointer events".
    await expect(potwierdz).toBeEnabled();
    const okno = potwierdz.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(okno).toHaveScreenshot('okno-wypisania-telefon.png');
  });
});

/* ── Stany meczu, w których NIE DA SIĘ dołączyć ─────────────────────────── */

test.describe('mecz w stanie szczególnym', () => {
  // Wspólny mianownik: człowiek wchodzi z linku i musi od razu zrozumieć,
  // dlaczego nie widzi przycisku „Dołącz". Brak komunikatu w którymkolwiek
  // z tych trzech przypadków wygląda jak zepsuta strona.

  test('odwołany — baner zamiast zapisu', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.odwolany);
    await uspokoj(page);

    const baner = tresc(page).getByText('Mecz odwołany', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await expect(baner).toBeVisible();
    await expect(tresc(page).getByText(/został odwołany przez organizatora/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Dołącz/ })).toHaveCount(0);
    await expect(baner).toHaveScreenshot('mecz-odwolany-baner.png');
  });

  test('prywatny — plakietka mówi, że mecz nie jest na liście', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.prywatny);
    await uspokoj(page);

    await expect(tresc(page).getByText('Prywatne', { exact: true }).first()).toBeVisible();
  });

  test('zagrany — po meczu nie ma czego dołączać', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.zagrany);
    await uspokoj(page);

    await expect(page.getByRole('button', { name: /^Dołącz/ })).toHaveCount(0);
    // Skład zagranego meczu nadal ma być widoczny — to jest pamięć o meczu,
    // a nie martwa strona.
    await expect(tresc(page).getByText('3 / 10')).toBeVisible();
  });
});

/* ── Udostępnianie ──────────────────────────────────────────────────────── */

test.describe('udostępnianie meczu', () => {
  test('„Kopiuj" potwierdza skopiowanie linku', async ({ page, context }) => {
    // Bez tego pozwolenia `navigator.clipboard.writeText()` rzuca wyjątkiem
    // i przycisk milczy — co wyglądałoby na regresję, a byłoby ustawieniem
    // przeglądarki testowej.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.wolneMiejsca);
    await uspokoj(page);

    await page.getByRole('button', { name: /^Kopiuj$/ }).click();
    await expect(page.getByRole('button', { name: /skopiowano/i })).toBeVisible();
  });
});

/* ── Moje gry: cztery zakładki ──────────────────────────────────────────── */

test.describe('moje gry', () => {
  // Każda zakładka ma własny stan pusty i własny układ. Do dziś nie pilnowało
  // ich nic — a to jest ekran, na który gracz wraca najczęściej.
  test('nadchodzące — mecze organizatora', async ({ page }) => {
    await zaloguj(page, KONTA.organizator);
    await page.goto('/moje-gry');
    await expect(page.getByRole('button', { name: 'Nadchodzące' })).toBeVisible();
    await uspokoj(page);
    // Same zakładki, bez listy: karty meczów niosą daty, które zmieniają się
    // z dnia na dzień.
    const zakladki = page.getByRole('button', { name: 'Nadchodzące' })
      .locator('xpath=ancestor::div[1]');
    await expect(zakladki).toHaveScreenshot('moje-gry-zakladki.png');
  });

  test('historia — stan pusty ma własny komunikat', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto('/moje-gry?tab=historia');
    await expect(page.getByText('Brak historii meczy')).toBeVisible({ timeout: 20_000 });
    await uspokoj(page);
    await expect(page.getByText('Brak historii meczy')
      .locator('xpath=ancestor::div[1]')).toHaveScreenshot('moje-gry-historia-pusto.png');
  });

  test('zaproszenia — stan pusty tłumaczy, kiedy się zapełni', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto('/moje-gry?tab=zaproszenia');
    await expect(page.getByText('Brak zaproszeń')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/gdy ktoś zaprosi cię na mecz/i)).toBeVisible();
    await uspokoj(page);
    await expect(page.getByText('Brak zaproszeń')
      .locator('xpath=ancestor::div[1]')).toHaveScreenshot('moje-gry-zaproszenia-pusto.png');
  });

  test('obserwowane — zakładka się otwiera', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto('/moje-gry?tab=obserwowane');
    await expect(page.getByRole('button', { name: /Obserwowane/ })).toBeVisible({ timeout: 20_000 });
  });
});

/* ── Grupy ──────────────────────────────────────────────────────────────── */

test.describe('grupy', () => {
  test('bez grup — zachęta zamiast pustki', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto('/grupy');
    await expect(page.getByText('Nie należysz jeszcze do żadnej grupy')).toBeVisible({ timeout: 20_000 });
    await uspokoj(page);
    await expect(page.getByText('Nie należysz jeszcze do żadnej grupy')
      .locator('xpath=ancestor::div[1]')).toHaveScreenshot('grupy-pusto.png');
  });

  test('zły kod grupy — komunikat, nie cisza', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto('/grupy');
    await expect(page.getByText('Masz kod grupy?')).toBeVisible({ timeout: 20_000 });

    await page.getByPlaceholder('K7QP4B').fill('ZZZZZZ');
    await page.getByRole('button', { name: /^Dołącz$/ }).click();
    // Cichy brak reakcji na zły kod to dokładnie ten rodzaj błędu, który
    // trudno zauważyć ręcznie — wygląda jak „przycisk nic nie robi".
    await expect(chmurka(page).getByText(/nie znaleziono grupy o tym kodzie/i)).toBeVisible();
    await uspokoj(page);
    await expect(chmurka(page)).toHaveScreenshot('grupy-zly-kod.png');
  });
});

/* ── Powiadomienia ──────────────────────────────────────────────────────── */

test.describe('powiadomienia', () => {
  test('dzwonek otwiera panel', async ({ page }) => {
    await zaloguj(page, KONTA.drugiGracz);
    await page.goto('/wydarzenia');
    await page.getByRole('button', { name: /powiadomienia/i }).first().click();
    await expect(page.getByText('Powiadomienia', { exact: true })).toBeVisible();
    await uspokoj(page);
    const panel = page.getByText('Powiadomienia', { exact: true })
      .locator('xpath=ancestor::div[2]');
    await expect(panel).toHaveScreenshot('panel-powiadomien.png');
  });
});

/* ── Kreator meczu ──────────────────────────────────────────────────────── */

test.describe('kreator meczu', () => {
  test('krok pierwszy — wybór sportu', async ({ page }) => {
    await zaloguj(page, KONTA.organizator);
    await page.goto('/wydarzenia/nowe');
    await expect(page.getByRole('button', { name: /dalej/i }).first()).toBeVisible({ timeout: 20_000 });
    await uspokoj(page);
    // Krok 1 nie ma w sobie żadnej daty ani liczby z bazy, więc cała strona
    // nadaje się na wzorzec.
    await expect(page).toHaveScreenshot('kreator-krok-1.png', { fullPage: true });
  });
});

/* ── Płatności: całe okno, nie tylko przycisk ───────────────────────────── */

test.describe('okno płatności', () => {
  test('wybór metody — wzorzec okna', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.platny);
    await uspokoj(page);

    await page.getByRole('button', { name: /^Dołącz/ }).first().click();
    await expect(page.getByText(/wybierz sposób płatności/i)).toBeVisible();
    await uspokoj(page);
    const okno = page.getByText(/wybierz sposób płatności/i)
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(okno).toHaveScreenshot('okno-platnosci.png');
  });
});
