import { test, expect } from '@playwright/test';

/**
 * BŁĄD SIECI TO NIE JEST BRAK MECZU.
 *
 * Strona meczu miała jeden `catch`, który na KAŻDY błąd renderował „Nie
 * znaleziono wydarzenia". Gorzej: pierwszą rzeczą w tym bloku było
 * `syncReserveClaim()`, czyli porządkowanie kolejki rezerwowej — czynność
 * POMOCNICZA, której awaria gasiła całą stronę.
 *
 * Dlaczego to boli akurat tutaj: strona meczu to jedyny artefakt, który
 * organizator wysyła 10–14 osobom. Gracz na słabym zasięgu dostawał komunikat
 * znaczący „twój kolega wysłał ci link do czegoś, czego nie ma" — i odbijało
 * się to na organizatorze, nie na Bojo.
 *
 * Atrapa siedzi WYŁĄCZNIE w sieci (`page.route`), ścieżka kodu w aplikacji jest
 * prawdziwa — ten sam wzorzec co w `wizualne.spec.ts`.
 */

const MECZ = '/wydarzenia/11111111-1111-4111-8111-111111111111';

test.describe('strona meczu — awaria wczytywania', () => {
  test('awaria serwera daje ekran ponowienia, nie „nie znaleziono”', async ({ page }) => {
    await page.route('**/rest/v1/events*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));

    await page.goto(MECZ);

    await expect(page.getByText('Nie udało się wczytać meczu')).toBeVisible();
    await expect(page.getByText('link jest w porządku')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Spróbuj ponownie' })).toBeVisible();
    // Najważniejsza asercja całego pliku: NIE wolno powiedzieć, że meczu nie ma.
    await expect(page.getByText('Nie znaleziono wydarzenia')).toHaveCount(0);
  });

  test('przycisk „Spróbuj ponownie” da się kliknąć i wczytuje jeszcze raz', async ({ page }) => {
    let prob = 0;
    await page.route('**/rest/v1/events*', (route) => {
      prob += 1;
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' });
    });

    await page.goto(MECZ);
    const przycisk = page.getByRole('button', { name: 'Spróbuj ponownie' });
    await expect(przycisk).toBeVisible();
    const przed = prob;
    // Klik musi być REALNY — o to chodzi w testach klikalności. Gdyby przycisk
    // przykrywał pasek nawigacji, Playwright zgłosi „intercepts pointer events".
    await przycisk.click();
    await expect.poll(() => prob).toBeGreaterThan(przed);
  });

  test('zero wierszy (PGRST116) nadal mówi, że meczu nie ma', async ({ page }) => {
    await page.route('**/rest/v1/events*', (route) =>
      route.fulfill({
        status: 406,
        contentType: 'application/json',
        // Dokładnie to, co PostgREST oddaje przy `.single()` bez wiersza.
        body: '{"code":"PGRST116","details":"The result contains 0 rows","message":"JSON object requested, multiple (or no) rows returned"}',
      }));

    await page.goto(MECZ);

    await expect(page.getByText('Nie znaleziono wydarzenia')).toBeVisible();
    await expect(page.getByText('Nie udało się wczytać meczu')).toHaveCount(0);
  });
});
