import { test, expect, type Page } from '@playwright/test';

/**
 * PUSTY STAN LISTY OBIEKTÓW nigdy nie jest ślepym zaułkiem.
 *
 * Przy oddalonej mapie lista jest pusta Z ZAŁOŻENIA (tryb skupisk — z bazy
 * lecą wtedy same liczby, nie obiekty). Stał tam wcześniej jeden przycisk:
 * „Przybliż tam, gdzie jest ich najwięcej" — odpowiedź na pytanie, którego
 * nikt nie zadaje, i to każąca naprawić stan mapy, której w widoku „Lista"
 * nawet nie widać. Zgłoszone wprost: „«przybliż tam, gdzie jest ich
 * najwięcej» jest słabe".
 *
 * Test pilnuje, że użytkownik dostaje DROGI DALEJ, a nie samą diagnozę:
 * „blisko mnie", miasta z liczbami i dopiero na końcu dawne przybliżenie.
 */

const LICZBY: Record<string, number> = {
  Warszawa: 3120, Kraków: 1840, Poznań: 1240, Wrocław: 1105,
  Łódź: 900, Gdańsk: 760, Szczecin: 610, Gdynia: 0,
};

async function podstaw(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* */ }
  });
  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    // Skupiska (RPC) — kilka komórek, żeby tryb skupisk był aktywny.
    if (url.includes('/rpc/mapa_skupiska')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([
          { lat: 52.23, lng: 21.01, ile: 3120 },
          { lat: 52.40, lng: 16.92, ile: 1240 },
        ]),
      });
    }
    // Zliczanie obiektów w mieście: supabase czyta liczbę z `content-range`.
    const miasto = decodeURIComponent(url.match(/city=eq\.([^&]+)/)?.[1] ?? '');
    if (miasto) {
      const ile = LICZBY[miasto] ?? 0;
      return route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-range': `0-0/${ile}`,
          'access-control-expose-headers': 'content-range',
        },
        body: '',
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });
}

test('pusta lista obiektów daje drogi dalej, nie tylko „przybliż"', async ({ page }) => {
  await podstaw(page);
  // `?gry=0` — pusty stan, o który tu chodzi, należy do KATALOGU OBIEKTÓW,
  // a gołe `/mapa` pokazuje od 2026-08-26 otwarte mecze.
  await page.goto('/mapa?gry=0');
  await page.waitForTimeout(3500);

  // Dwa przełączniki w DOM (nakładka mobilna i pasek desktopu) — trafiamy
  // w widoczny, pułapka opisana w AGENTS.md.
  await page.getByRole('radio', { name: 'Lista' }).filter({ visible: true }).first().click();
  await page.waitForTimeout(2500);

  // 1. Główna droga: jedno dotknięcie, zero wiedzy o mapie.
  await expect(page.getByRole('button', { name: /Pokaż boiska blisko mnie/ })).toBeVisible();

  // 2. Miasta Z LICZBAMI, posortowane malejąco — liczba mówi, gdzie w ogóle
  //    jest co oglądać. Miasto bez obiektów (Katowice ma 0 w atrapie niżej)
  //    nie ma prawa się pokazać.
  const kafelki = page.getByRole('button', { name: /^(Warszawa|Kraków|Poznań|Gdynia)/ });
  await expect(kafelki.first()).toContainText('Warszawa');
  // Bez spacji: `toLocaleString('pl-PL')` grupuje dopiero od pięciu cyfr
  // (`minimumGroupingDigits` = 2 dla polskiego), więc 3120 zostaje 3120.
  await expect(kafelki.first()).toContainText('3120');
  await expect(page.getByRole('button', { name: /^Gdynia/ })).toHaveCount(0);

  // 3. Dawne przybliżenie zostaje, ale jako cicha droga na końcu.
  await expect(page.getByRole('button', { name: /Przybliż tam/ })).toBeVisible();
});

test('szukajka podpowiada miasta, też wpisane bez ogonków', async ({ page }) => {
  // Katalog ma dziesiątki tysięcy obiektów o nazwach rodzajowych („Boisko
  // sportowe" tysiąc razy), więc wpisanie NAZWY rzadko trafia w to, czego ktoś
  // szuka — a wpisanie MIASTA trafia zawsze.
  await podstaw(page);
  await page.goto('/mapa?gry=0');

  const pole = page.getByRole('textbox', { name: /Szukaj boiska/ }).filter({ visible: true }).first();
  await pole.fill('poznan');

  const podpowiedz = page.getByRole('button', { name: /^Poznań/ }).filter({ visible: true }).first();
  await expect(podpowiedz).toBeVisible({ timeout: 15_000 });
  await expect(podpowiedz).toContainText('1240');

  // Miasto bez ani jednego obiektu nie ma prawa być podpowiedzią (Gdynia ma
  // w atrapie zero).
  await pole.fill('gdy');
  await expect(page.getByRole('button', { name: /^Gdynia/ })).toHaveCount(0);
});
