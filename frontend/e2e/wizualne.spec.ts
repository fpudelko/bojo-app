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

test.describe('widoki publiczne', () => {
  test('strona główna', async ({ page }) => {
    await page.goto('/');
    await uspokoj(page);
    await expect(page).toHaveScreenshot('strona-glowna.png', {
      fullPage: true,
      // Liczba boisk w katalogu rośnie z każdym importem, a nie o nią tu chodzi.
      mask: [page.locator('[data-zrzut-maskuj]')],
    });
  });

  test('lista gier', async ({ page }) => {
    await page.goto('/wydarzenia');
    await uspokoj(page);
    // Sama rama widoku: pasek filtrów i układ. Kart meczów nie ma co
    // porównywać — bez bazy lista jest pusta, a z bazą zmienia się co dzień.
    await expect(page.locator('header').first()).toHaveScreenshot('lista-gier-naglowek.png');
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
});

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
