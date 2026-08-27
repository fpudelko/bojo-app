import { test, expect } from '@playwright/test';

// Klikalność, nie wygląd.
//
// Playwright przed kliknięciem sprawdza, czy element faktycznie odbiera
// zdarzenia wskaźnika. Gdy coś go przykrywa, test pada komunikatem
// „<div> intercepts pointer events" — i to jest dokładnie ta klasa błędu, przez
// którą przycisk „Dołącz" przestał działać na produkcji, a `tsc`, ESLint
// i 397 testów jednostkowych nie miały jak tego zobaczyć.

test.describe('strony publiczne wstają i nie mają martwych warstw', () => {
  for (const [nazwa, sciezka] of [
    ['strona główna', '/'],
    ['lista gier', '/wydarzenia'],
    ['mapa', '/mapa'],
    ['logowanie', '/logowanie'],
    ['jak działa Bojo', '/jak-dziala-bojo'],
    ['dlaczego Bojo', '/dlaczego-bojo'],
    ['FAQ', '/faq'],
  ] as const) {
    test(`${nazwa} renderuje się bez błędu w konsoli`, async ({ page }) => {
      const bledy: string[] = [];
      page.on('pageerror', (e) => bledy.push(e.message));

      const odpowiedz = await page.goto(sciezka);
      expect(odpowiedz?.status(), `${sciezka} zwróciło ${odpowiedz?.status()}`).toBeLessThan(400);
      await expect(page.locator('body')).toBeVisible();

      // Błędy sieciowe do Supabase są tu spodziewane (atrapa klucza) — nie one
      // nas interesują, tylko wywrotki samego kodu strony.
      const istotne = bledy.filter((b) => !/supabase|fetch|network|Failed to fetch/i.test(b));
      expect(istotne, `błędy JS na ${sciezka}:\n${istotne.join('\n')}`).toHaveLength(0);
    });
  }
});

test.describe('nawigacja dolna nie przykrywa treści', () => {
  test('pasek nawigacji nie zasłania stopki strony głównej', async ({ page }) => {
    await page.goto('/');
    // Pasek pokazuje się tylko zalogowanym, więc na tej ścieżce ma go nie być.
    // Test pilnuje, że nie wjechał tam przypadkiem — pasek na widoku dla
    // niezalogowanych przykrywałby przycisk rejestracji.
    await expect(page.getByLabel('Nawigacja dolna')).toHaveCount(0);
  });
});

test.describe('modal jest nad wszystkim', () => {
  // Filtry na liście gier to jedyny modal osiągalny bez logowania — a chodzi
  // o warstwę, nie o konkretne okno: wszystkie modale w repo biorą z-index
  // z tej samej stałej (`WARSTWA.modal` w lib/warstwy.ts).
  test('okno filtrów daje się otworzyć i zamknąć', async ({ page }) => {
    await page.goto('/wydarzenia');

    const filtry = page.getByRole('button', { name: /filtry/i }).first();
    if ((await filtry.count()) === 0) test.skip(true, 'brak przycisku filtrów w tym widoku');

    await filtry.click();
    const okno = page.getByRole('dialog');
    await expect(okno).toBeVisible();

    // Klik w przycisk zamknięcia. Gdyby modal siedział pod paskiem albo pod
    // nagłówkiem, to kliknięcie padłoby na „intercepts pointer events".
    await page.getByRole('button', { name: /zamknij/i }).first().click();
    await expect(okno).toBeHidden();
  });
});

test.describe('mapa', () => {
  test('kontener mapy zajmuje widoczny obszar', async ({ page }) => {
    // `?gry=0`: od 2026-08-26 gołe `/mapa` otwiera się na LIŚCIE otwartych
    // meczów, a kontener Leafleta ma wtedy `display: none`. Ten test jest
    // o geometrii mapy katalogu, więc prosi o nią wprost.
    await page.goto('/mapa?gry=0');
    const mapa = page.locator('.leaflet-container');
    await expect(mapa).toBeVisible({ timeout: 30_000 });

    const pudelko = await mapa.boundingBox();
    expect(pudelko?.height ?? 0).toBeGreaterThan(200);
  });
});
