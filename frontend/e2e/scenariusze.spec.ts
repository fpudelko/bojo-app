import { test, expect, type Locator, type Page } from '@playwright/test';

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
// JEDEN WĄTEK, NIE DWA (`--workers=1` w `npm run scenariusze`). Baza jest
// jedna na cały przebieg, a te same scenariusze lecą w dwóch rozmiarach okna.
// Dwa wątki zapisujące się równolegle na ten sam mecz dawałyby licznik „4 / 10"
// tam, gdzie test spodziewa się „3 / 10" — i wyglądałoby to na regresję
// aplikacji. Z tego samego powodu każdy test, który coś zapisuje, sam po sobie
// sprząta (`wypiszSie()`).
//
// Skutek uboczny: same daty w interfejsie zmieniają się z dnia na dzień.
// Dlatego zrzuty obejmują FRAGMENTY bez daty (licznik, okno zapisu, kolejka),
// a nie całą stronę. Ochrona przed regresją siedzi w asercjach zachowania —
// zrzut dokłada do tego układ i kolory.
//
// WZORCE TYCH SCENARIUSZY leżą w `e2e/wzorce/scenariusze-*` i są **punktem
// odniesienia**, nie wzorem tego, jak powinno być. Zostały przyjęte hurtem
// jako stan zastany — od tej chwili raport pokazuje wyłącznie to, co się
// wobec nich ZMIENIŁO, zamiast za każdym razem wypisywać czterdzieści
// „nowych widoków". Jeśli któryś wygląda źle, to jest zwykły błąd do
// naprawienia, a nie powód, żeby podważać wzorzec.

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
  platnyZagrany:  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  zRozmowa:       'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
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

/**
 * Sprząta po teście, który się zapisał na mecz.
 *
 * DLACZEGO TO MUSI BYĆ: baza jest JEDNA na cały przebieg, a te same testy
 * lecą w dwóch rozmiarach okna. Bez sprzątania drugi przebieg zastaje mecz
 * z dodatkowym uczestnikiem i asercja „2 / 10" pada — nie dlatego, że coś
 * się zepsuło, tylko dlatego, że poprzedni test zostawił po sobie ślad.
 * Ta sama pułapka dotyczy ponowienia po błędzie (`retries: 1`).
 *
 * Świadomie NIE jest to `afterEach`: wypisanie samo w sobie jest przejściem
 * użytkownika i chcemy, żeby padło głośno, gdy przestanie działać.
 */
async function wypiszSie(page: Page) {
  await klik(page, /wypisz się z (meczu|rezerwy)/i);
  await klik(page, 'Wypisz mnie', { exact: true });
  await expect(page.getByRole('button', { name: /^Dołącz|komplet — na rezerwę/i }).first())
    .toBeVisible({ timeout: 15_000 });
}

/**
 * Co REALNIE widać na stronie — nazwy widocznych przycisków i początek treści.
 *
 * PO CO. „Test timeout of 30000ms exceeded — waiting for getByRole('button',
 * { name: /komplet — na rezerwę/i })" nie niesie ani jednej informacji poza
 * tym, czego szukaliśmy. Żeby zobaczyć napis, który jest NAPRAWDĘ, trzeba było
 * osobnego przebiegu CI (~18 minut) — i to się zdarzyło kilka razy z rzędu,
 * bo teksty przycisków zmieniają się częściej niż testy. Od teraz padający
 * scenariusz mówi, co zastał.
 */
async function coWidac(page: Page): Promise<string> {
  const nazwy: string[] = [];
  for (const p of await page.getByRole('button').all()) {
    if (!(await p.isVisible().catch(() => false))) continue;
    const n = (await p.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (n) nazwy.push(n);
  }
  const tekst = await page.evaluate(() => document.body.innerText.slice(0, 700)).catch(() => '');
  return `Widoczne przyciski: ${nazwy.join(' | ') || '(żadnego)'}\nTreść strony:\n---\n${tekst}\n---`;
}

/** Klika przycisk, a gdy go nie ma — mówi, jakie przyciski są. */
async function klik(page: Page, nazwa: RegExp | string, opcje: { exact?: boolean } = {}) {
  try {
    await page.getByRole('button', { name: nazwa, ...opcje }).first().click({ timeout: 15_000 });
  } catch {
    throw new Error(`Nie ma przycisku ${nazwa}.\n${await coWidac(page)}`);
  }
}

/** Czeka na element, a gdy go nie ma — mówi, co zamiast niego stoi na stronie. */
async function pokazSie(page: Page, cel: Locator, opis: string) {
  try {
    await expect(cel).toBeVisible({ timeout: 15_000 });
  } catch {
    throw new Error(`Nie widać: ${opis}.\n${await coWidac(page)}`);
  }
}

/**
 * Doprowadza otwarty mecz do stanu „nie jestem zapisany".
 *
 * PO CO. Baza jest jedna na cały przebieg, a każdy zapisujący się test sprząta
 * po sobie sam (`wypiszSie`) — dopóki nie padnie WCZEŚNIEJ. Wtedy zostaje
 * zapisany, a ponowienie i drugi rozmiar okna zastają stan, w którym paska
 * z „Dołącz" nie ma wcale, bo `joinBarVisible` chowa go uczestnikowi.
 *
 * Objawem jest wtedy „nie ma przycisku", a przyczyną — poprzednia porażka
 * tego samego testu. Realnie kosztowało to dwa przebiegi CI i wyglądało jak
 * zepsuty przycisk: dopiero zrzut treści strony pokazał „Jesteś na liście
 * rezerwowej". Ten helper odcina kaskadę — jedna zepsuta rzecz ma dawać jedną
 * czerwoną kropkę, nie trzy.
 */
async function niezapisany(page: Page) {
  const wyjscie = page.getByRole('button', { name: /wypisz się z (meczu|rezerwy)/i });
  if (await wyjscie.isVisible().catch(() => false)) await wypiszSie(page);
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
    await niezapisany(page);
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

    await wypiszSie(page);
    await expect(tresc(page).getByText('2 / 10')).toBeVisible();
  });

  test('komplet — komunikat mówi WPROST o rezerwie', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.komplet);
    await niezapisany(page);
    await uspokoj(page);

    // Napis skrócony do „Komplet — na rezerwę", gdy obok stanął „Obserwuj"
    // (dwa przyciski w jednym pasku muszą się zmieścić na telefonie).
    await klik(page, /komplet — na rezerwę/i);
    await klik(page, /zapisz mnie/i);

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

    await wypiszSie(page);
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
    // Zamykamy okno bez zapisu — ten test celowo NIC nie zmienia w bazie,
    // sprawdza wyłącznie ostrzeżenie przed zapisem.
    await page.keyboard.press('Escape');
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
    // Tak samo jak wyżej: okno zamykamy bez zapisu, żeby skład został nietknięty.
    await page.keyboard.press('Escape');
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

    // Dwa kliknięcia, nie jedno: karta ma krótkie „Przestań", a rezygnacja
    // przechodzi przez to samo okno potwierdzenia co wypisanie się ze składu
    // (tam przycisk nazywa się „Przestań obserwować").
    await page.getByRole('button', { name: /^Przestań$/i }).first().click();
    await page.getByRole('button', { name: /^Przestań obserwować$/i }).click();
    await expect(page.getByRole('button', { name: /^Obserwuj$/i })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('okna na telefonie', () => {
  test('okno wypisania jest nad paskiem nawigacji i da się kliknąć', async ({ page }, info) => {
    test.skip(!info.project.name.includes('telefon'), 'dotyczy tylko widoku telefonu');

    await zaloguj(page, KONTA.organizator);
    await otworzMecz(page, MECZ.wolneMiejsca);
    await uspokoj(page);

    await klik(page, /wypisz się z meczu/i);
    // Gdyby okno siedziało pod paskiem, Playwright zgłosi „intercepts pointer
    // events" właśnie tutaj — to jest test na tę konkretną regresję.
    // `exact`, bo w oknie stoi teraz także „Wypisz mnie, ale obserwuj" —
    // wzorzec bez kotwicy trafiał w oba i Playwright przerywał na strict mode.
    const potwierdz = page.getByRole('button', { name: 'Wypisz mnie', exact: true });
    await pokazSie(page, potwierdz, 'potwierdzenie „Wypisz mnie" w oknie');
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
    // ORGANIZATOR, nie gracz. Panel „Zaproś znajomych" renderuje się WYŁĄCZNIE
    // komuś, kto jest w środku (`myParticipation || isOwner || myDelegate`) —
    // dla kogoś z zewnątrz nie ma go wcale, więc poprzednia wersja tego testu
    // czekała 30 sekund na przycisk, którego nie mogło być.
    // Napisu „Kopiuj link" też już nie ma: taki stoi w karcie „Mecz gotowy",
    // widocznej tylko przez pierwszą minutę po utworzeniu meczu.
    await zaloguj(page, KONTA.organizator);
    await otworzMecz(page, MECZ.wolneMiejsca);
    await uspokoj(page);

    const panel = tresc(page).getByText('Zaproś znajomych')
      .locator('xpath=ancestor::div[1]');
    await pokazSie(page, panel, 'panel „Zaproś znajomych"');
    await panel.getByRole('button', { name: 'Kopiuj', exact: true }).click();
    // Potwierdzenie siedzi w SAMYM przycisku (napis zmienia się na „OK"),
    // nie w chmurce — panel nie woła toasta.
    await pokazSie(page, panel.getByRole('button', { name: 'OK', exact: true }),
      'potwierdzenie „OK" na przycisku kopiowania');
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
    // `drugiGracz`, nie `gracz`. Konto `gracz` siedzi w składzie W11 — meczu
    // płatnego, KTÓRY JUŻ SIĘ ODBYŁ (doszedł razem ze scenariuszami o numerze
    // BLIK) — więc jego historia przestała być pusta i test o STANIE PUSTYM
    // padał, choć stan pusty działa. `drugiGracz` jest w tym pliku kontem
    // „kogoś z zewnątrz" i seed nie wpisuje go do żadnego meczu.
    await zaloguj(page, KONTA.drugiGracz);
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
    // Produkt mówi „ekipa", nie „grupa" — trasa i kod zostały, treść nie.
    const pusto = page.getByText('Nie masz jeszcze ekipy');
    await expect(pusto).toBeVisible({ timeout: 20_000 });
    await uspokoj(page);
    await expect(pusto.locator('xpath=ancestor::div[1]')).toHaveScreenshot('grupy-pusto.png');
  });

  test('zły kod grupy — komunikat, nie cisza', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto('/grupy');
    // Pole na kod przeniosło się do arkusza na dole ekranu. Wejście zależy od
    // tego, czy masz już jakąś ekipę: bez ekip jest „Mam kod" w pustym stanie,
    // z ekipami — „Masz kod zaproszenia?" pod listą. To konto nie ma żadnej.
    await expect(page.getByText('Nie masz jeszcze ekipy')).toBeVisible({ timeout: 20_000 });
    await klik(page, /^Mam kod$/);
    await expect(page.getByText('Masz kod zaproszenia?')).toBeVisible();

    await page.getByPlaceholder('K7QP4B').fill('ZZZZZZ');
    await klik(page, /^Dołącz$/);
    // Cichy brak reakcji na zły kod to dokładnie ten rodzaj błędu, który
    // trudno zauważyć ręcznie — wygląda jak „przycisk nic nie robi".
    // Treść niesie WPROST baza: `dolacz_do_grupy_kodem` (migracja 094) rzuca
    // „Nie ma grupy o tym kodzie", a `KodGrupySheet` podaje `e.message` do
    // toasta bez przepisywania. Test zgadywał wcześniej inne brzmienie.
    await pokazSie(page, chmurka(page).getByText(/nie ma grupy o tym kodzie/i),
      'chmurka z komunikatem o nieznanym kodzie');
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
    await page.keyboard.press('Escape');
  });
});

/* ── Prośba o dołączenie, od strony gracza ──────────────────────────────── */

test.describe('prośba o dołączenie', () => {
  test('gracz widzi, na co czeka i jak się o tym dowie', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.doAkceptacji);
    await uspokoj(page);

    await page.getByRole('button', { name: /^Dołącz|poproś/i }).first().click();
    const zapisz = page.getByRole('button', { name: /zapisz mnie|wyślij prośbę/i }).first();
    if (await zapisz.isVisible().catch(() => false)) await zapisz.click();

    await expect(chmurka(page).getByText(/wysłano prośbę o dołączenie/i)).toBeVisible();
    const kafel = tresc(page).getByText('Oczekujesz na akceptację', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(kafel).toBeVisible();
    // „Skąd będę wiedział, że zaakceptował?" — to zdanie jest odpowiedzią
    // i ma zostać na ekranie.
    await expect(kafel.getByText(/dostaniesz\s+powiadomienie w Bojo/i)).toBeVisible();
    await uspokoj(page);
    await expect(kafel).toHaveScreenshot('oczekuje-na-akceptacje.png');

    // Sprzątanie — prośba nie może zostać na kolejny przebieg.
    await page.getByRole('button', { name: /^Anuluj$/ }).click();
    await expect(tresc(page).getByText('Oczekujesz na akceptację', { exact: true }))
      .toHaveCount(0, { timeout: 15_000 });
  });
});

/* ── Skład: kto jest kim ────────────────────────────────────────────────── */

test.describe('skład', () => {
  test('zawodnik z pola ma własne oznaczenie, tak jak bramkarz', async ({ page }) => {
    // Zgłoszenie wprost: „gracz z pola ma mieć analogiczne oznaczenie jak
    // bramkarz ma BR". Bez tego lista wyglądała, jakby oznaczenie miały
    // wyłącznie bramkarze, a reszta była nieopisana.
    //
    // GRACZ, nie organizator — mimo że organizatorowi lista rozwija się sama.
    // Skład renderuje się w DWÓCH wariantach: właścicielowi i osobie od składu
    // (`isOwner || canManageSquad`) w wersji do zarządzania, gdzie wiersz to
    // `<li>` z kontrolkami i BEZ plakietki roli; wszystkim pozostałym —
    // przez `ParticipantsList`, i to tam mieszka „⚽ POLE". Testowanie tego
    // z konta organizatora sprawdzało widok, który tej plakietki nie ma.
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.rezerwacjaBr);
    await uspokoj(page);

    // Lista startuje ZWINIĘTA (`rosterOpen === false`) i rozwija ją kliknięcie
    // w stos awatarów. Sam przycisk nie ma tekstu — awatary niosą `title`.
    await tresc(page).getByTitle('Zawodnik 1', { exact: true }).first().click();

    // Wiersz to `div.py-2`, nie `li` — ta lista nigdy nie była `<ul>`, choć
    // pierwsza wersja tego testu tak zakładała.
    const wiersz = tresc(page).getByText('Zawodnik 1', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"py-2")][1]');
    await pokazSie(page, wiersz, 'wiersz składu z „Zawodnik 1"');
    await expect(wiersz.getByText(/POLE/)).toBeVisible();
    await expect(wiersz).toHaveScreenshot('sklad-oznaczenie-pola.png');
  });
});

/* ── Filtrowanie i sortowanie listy ─────────────────────────────────────── */

test.describe('lista gier — narzędzia', () => {
  test('okno filtrów', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto('/wydarzenia');
    await page.getByRole('button', { name: 'Filtry' }).click();
    const okno = page.getByRole('dialog');
    await expect(okno).toBeVisible();
    await uspokoj(page);
    await expect(okno).toHaveScreenshot('okno-filtrow.png');
  });

  test('menu sortowania', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto('/wydarzenia');
    // Sortowanie nie ma już własnej pigułki — zjechało do arkusza filtrów
    // (sekcja „Kolejność"). Sprawdzamy, że arkusz się otwiera i ma pozycję
    // domyślną.
    await page.getByRole('button', { name: 'Filtry' }).click();
    const okno = page.getByRole('dialog');
    await expect(okno).toBeVisible();
    await expect(okno.getByText('Kolejność')).toBeVisible();
    await expect(okno.getByText('Najbliższy termin')).toBeVisible();
  });
});

/* ── Grupy: zakładanie ──────────────────────────────────────────────────── */

test.describe('nowa grupa', () => {
  test('formularz zakładania grupy', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto('/grupy/nowe');
    // Nie `form` ani „pierwszy input": strona nie ma elementu `form`, a
    // pierwszym `input` jest UKRYTE pole na plik (okładka ekipy) — asercja
    // widoczności padała na nim, nie na formularzu. Celujemy w pole, które
    // człowiek naprawdę wypełnia.
    await expect(page.getByPlaceholder('np. Czwartkowa gierka'))
      .toBeVisible({ timeout: 20_000 });
    await uspokoj(page);
    await expect(page).toHaveScreenshot('grupa-nowa-formularz.png', { fullPage: true });
  });
});

/* ── Profil ─────────────────────────────────────────────────────────────── */

test.describe('profil', () => {
  test('widok konta', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto('/profil');
    await expect(page.getByRole('button', { name: /wyloguj/i }).first())
      .toBeVisible({ timeout: 20_000 });
    await uspokoj(page);
    // Awatar i nazwa pochodzą z konta testowego, więc są stałe — cała strona
    // nadaje się na wzorzec.
    await expect(page).toHaveScreenshot('profil.png', { fullPage: true });
  });
});

/* ── Kreator meczu: dalsze kroki ────────────────────────────────────────── */

test.describe('kreator meczu — kolejne kroki', () => {
  test('bez miejsca kreator nie puszcza dalej i mówi dlaczego', async ({ page }) => {
    // Pierwsza wersja tego testu klikała „Dalej" i oczekiwała kroku drugiego.
    // To było błędne założenie: krok 1 wymaga LOKALIZACJI (`validateStep1`),
    // a wybranie miejsca to wyszukiwarka boisk z siecią — czyli dokładnie ten
    // rodzaj zależności, przez który scenariusz robi się kruchy. Sprawdzamy
    // więc rzecz cenniejszą i stabilną: że bramka działa i tłumaczy się.
    await zaloguj(page, KONTA.organizator);
    await page.goto('/wydarzenia/nowe');
    const dalej = page.getByRole('button', { name: /^Dalej/ });
    await expect(dalej).toBeVisible({ timeout: 20_000 });

    await dalej.click();
    await expect(page.getByText(/wskaż lokalizację/i)).toBeVisible();
    // I nie przeskoczyliśmy dalej — „Wróć" pojawia się dopiero od kroku 2.
    await expect(page.getByRole('button', { name: /wróć/i })).toHaveCount(0);
  });
});

/* ── Numer BLIK: kto go widzi, a kto tylko wyjaśnienie ──────────────────── */

// Migracje `120`/`121` wyjęły numer z `events` do osobnej tabeli `event_blik`
// z własną polityką RLS, bo `events` czyta każdy — także niezalogowany. Te dwa
// scenariusze pilnują OBU stron tej zmiany przez interfejs: że numer dochodzi
// do kogoś ze składu (czyli osadzenie `event_blik(blik_phone)` działa) i że
// osoba spoza składu dostaje zdanie wyjaśniające zamiast pustki. Drugie jest
// łatwe do zepsucia: warunek renderowania nie może pytać o sam numer, bo
// wtedy wyjaśnienie znika dokładnie przed tym, komu jest potrzebne.

test.describe('numer BLIK', () => {
  test('uczestnik widzi numer', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.platnyZagrany);
    await uspokoj(page);

    // Mecz jest z wczoraj, więc reguła „dopiero na godzinę przed" (canSeeBlikPhone)
    // przepuszcza numer — patrz komentarz przy W11 w seed_wizualne.sql.
    await expect(tresc(page).getByText('555111222').first()).toBeVisible();
  });

  test('ktoś spoza składu dostaje wyjaśnienie, nie pustkę', async ({ page }) => {
    await zaloguj(page, KONTA.drugiGracz);
    await otworzMecz(page, MECZ.platnyZagrany);
    await uspokoj(page);

    await expect(tresc(page).getByText('555111222')).toHaveCount(0);
    await expect(tresc(page).getByText(/numer do BLIKA zobaczysz, jeśli dołączysz/i))
      .toBeVisible();
  });

  test('okno dołączania mówi, kiedy numer się pokaże', async ({ page }) => {
    await zaloguj(page, KONTA.drugiGracz);
    await otworzMecz(page, MECZ.platny);
    await uspokoj(page);

    await page.getByRole('button', { name: /^Dołącz/ }).first().click();
    await page.getByRole('button', { name: /^BLIK$/i }).click();
    // Dawniej w tym miejscu stał numer telefonu organizatora, pokazywany
    // każdemu, kto otworzył okno — łącznie z osobą, która się nie zapisze.
    await expect(page.getByText(/numer do BLIKA zobaczysz po zapisaniu się/i)).toBeVisible();
  });
});

/* ── Rozmowa meczu ──────────────────────────────────────────────────────── */

// Rozmowa jest od migracji `120` domknięta REGUŁĄ W BAZIE, nie tylko warunkiem
// w komponencie. Tu sprawdzamy to od strony użytkownika: uczestnik czyta i
// pisze, ktoś spoza składu nie ma nawet zakładki. Asercji na treść cudzej
// wiadomości u obcego świadomie NIE ma — gdyby zakładka zniknęła, a dane
// dalej wychodziły, test i tak by tego nie zobaczył; od tego jest
// `supabase/test/rls.sql`, który pyta bazę wprost.

test.describe('rozmowa meczu', () => {
  test('uczestnik czyta i pisze', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await otworzMecz(page, MECZ.zRozmowa);
    await uspokoj(page);

    // Nie `/^Rozmowa$/`: przy nieprzeczytanych wiadomościach nazwa przycisku
    // to „Rozmowa 1" (plakietka jest w środku), więc kotwica na końcu
    // odpadałaby dokładnie wtedy, gdy jest co czytać.
    await page.getByRole('button', { name: /^Rozmowa/ }).click();
    await expect(page.getByText(/Parkujemy od strony szkoły/i)).toBeVisible();

    // Znacznik czasu w treści, bo baza żyje przez cały przebieg i te same
    // scenariusze lecą w dwóch rozmiarach okna — bez tego druga runda
    // szukałaby wiadomości, których jest już kilka.
    const tresc_ = `test ${Date.now()}`;
    await page.getByPlaceholder(/Napisz do uczestników/i).fill(tresc_);
    await page.getByRole('button', { name: /^Wyślij$/i }).click();
    await expect(page.getByText(tresc_)).toBeVisible({ timeout: 15_000 });
  });

  test('ktoś spoza składu widzi zakładkę, ale nie treść', async ({ page }) => {
    await zaloguj(page, KONTA.drugiGracz);
    await otworzMecz(page, MECZ.zRozmowa);
    await uspokoj(page);

    // Pierwsza wersja tego testu zakładała, że zakładki NIE MA. To była pomyłka
    // co do produktu, nie błąd aplikacji: `widoczneZakladkiObiekty` filtruje
    // Ustawienia, Wynik, Rozliczenia i Taktykę, ale Rozmowę pokazuje zawsze —
    // bramkowana jest TREŚĆ, zdaniem wyjaśniającym, kto ją widzi. Tak jest
    // lepiej: zakładka, która znika bez słowa, wygląda jak brak funkcji.
    await page.getByRole('button', { name: /^Rozmowa/ }).click();
    await expect(page.getByText(/widoczna wyłącznie dla uczestników/i)).toBeVisible();
    await expect(page.getByText(/Parkujemy od strony szkoły/i)).toHaveCount(0);
  });
});
