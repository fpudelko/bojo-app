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
};

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
  await expect(page.getByRole('button', { name: /powiadomienia/i }).first())
    .toBeVisible({ timeout: 15_000 });
}

test.describe('dołączanie do meczu', () => {
  test('wolne miejsca — wchodzi do składu i komunikat to potwierdza', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto(`/wydarzenia/${MECZ.wolneMiejsca}`);
    await uspokoj(page);

    const licznik = page.getByText('2 / 10').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(licznik).toBeVisible();
    await expect(licznik).toHaveScreenshot('licznik-przed-dolaczeniem.png');

    await page.getByRole('button', { name: /^Dołącz/ }).first().click();
    await page.getByRole('button', { name: /zapisz mnie/i }).click();

    // Sedno: komunikat mówi o SKŁADZIE, nie o rezerwie.
    await expect(page.getByText(/dołączyłeś do meczu/i)).toBeVisible();
    await expect(page.getByText('3 / 10')).toBeVisible();
    await uspokoj(page);
    const po = page.getByText('3 / 10').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(po).toHaveScreenshot('licznik-po-dolaczeniu.png');
  });

  test('komplet — komunikat mówi WPROST o rezerwie', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto(`/wydarzenia/${MECZ.komplet}`);
    await uspokoj(page);

    await page.getByRole('button', { name: /komplet — zapisz się na rezerwę/i }).click();
    await page.getByRole('button', { name: /zapisz mnie/i }).click();

    // Regresja z tej sesji: mówiło „Dołączyłeś do meczu!" komuś na rezerwie.
    await expect(page.getByText(/jesteś na liście rezerwowej/i)).toBeVisible();
    const karta = page.getByText(/jesteś na liście rezerwowej/i)
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(page.getByText(/nie masz miejsca w składzie/i)).toBeVisible();
    await uspokoj(page);
    await expect(karta).toHaveScreenshot('karta-rezerwy.png');
  });
});

test.describe('miejsca dla bramkarzy — dwa tryby obok siebie', () => {
  // Ta para to całe zgłoszenie o „trzynastym graczu": ten sam skład,
  // przeciwny wynik, różnica wyłącznie w trybie miejsc.
  test('rezerwacja — zawodnik z pola dostaje ostrzeżenie przed zapisem', async ({ page }) => {
    await zaloguj(page, KONTA.gracz);
    await page.goto(`/wydarzenia/${MECZ.rezerwacjaBr}`);
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
    await page.goto(`/wydarzenia/${MECZ.wspolnaPula}`);
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

    await page.goto(`/wydarzenia/${MECZ.doAkceptacji}`);
    await uspokoj(page);
    // Sekcja próśb — bez dat, więc nadaje się na wzorzec.
    const prosby = page.getByText(/czeka na akceptację|prośby o dołączenie/i).first()
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(prosby).toHaveScreenshot('prosby-organizator.png');
  });

  test('kolejka rezerwowa z przyciskiem „Do składu"', async ({ page }) => {
    await zaloguj(page, KONTA.organizator);
    await page.goto(`/wydarzenia/${MECZ.kolejka}`);
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
    await page.goto(`/wydarzenia/${MECZ.platny}`);
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
    await page.goto(`/wydarzenia/${MECZ.wolneMiejsca}`);
    await uspokoj(page);

    await page.getByRole('button', { name: /^Obserwuj$/i }).click();
    await expect(page.getByText(/obserwujesz ten mecz/i)).toBeVisible();

    // Regresja z tej sesji: obserwujący siedzi w bazie z `is_reserve = true`
    // i przez to pokazywał się w kolejce rezerwowej.
    await expect(page.getByText(/rezerwa — kolejka/i)).toHaveCount(0);
  });
});

test.describe('okna na telefonie', () => {
  test('okno wypisania jest nad paskiem nawigacji i da się kliknąć', async ({ page }, info) => {
    test.skip(!info.project.name.includes('telefon'), 'dotyczy tylko widoku telefonu');

    await zaloguj(page, KONTA.organizator);
    await page.goto(`/wydarzenia/${MECZ.wolneMiejsca}`);
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
