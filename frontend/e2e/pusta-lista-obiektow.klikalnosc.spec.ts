import { test, expect, type Page } from '@playwright/test';

/**
 * LISTA OBIEKTÓW DOBIERA SIĘ SAMA, PO WSPÓŁRZĘDNYCH.
 *
 * Przy oddalonej mapie lista jest pusta z założenia (tryb skupisk — z bazy lecą
 * same liczby w siatce, nie obiekty). Przechodziła przez trzy wcielenia:
 *
 *  1. jeden przycisk „Przybliż tam, gdzie jest ich najwięcej" — odpowiedź na
 *     pytanie, którego nikt nie zadaje,
 *  2. kafelki miast z liczbami z `fields.city` — kolumna okazała się wypełniona
 *     w jakichś dwóch procentach (38 314 obiektów w katalogu, wszystkie miasta
 *     razem ~900), więc kafelek kłamał liczbą i dowoził do garstki,
 *  3. dziś: lista wypełnia się SAMA obiektami wokół punktu — okolicy gracza,
 *     gdy zgoda na lokalizację jest już udzielona, a bez niej Poznania.
 *
 * `lat`/`lng` ma każdy obiekt w katalogu, więc ten dobór nie zależy od
 * backfillu lokalizacji.
 */

/** Boisko w okolicy Poznania — atrapa oddaje je na każde zapytanie o kadr. */
const BOISKO = {
  id: 'f1', name: 'Orlik Rataje', address: 'Poznań, os. Piastowskie',
  lat: 52.4, lng: 16.95, sport: ['piłka nożna'], venue_type: 'orlik', surface: 'sztuczna',
};

async function podstaw(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });
  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/rpc/mapa_skupiska')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ lat: 52.4, lng: 16.92, ile: 1240 }]),
      });
    }
    // Zapytanie o KADR (ma granice lat/lng) — tak dobiera się lista startowa.
    if (url.includes('/fields') && url.includes('lat=gte')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': '0-0/1' }, body: JSON.stringify([BOISKO]),
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });
}

const widoczny = (page: Page, nazwa: string) =>
  page.getByRole('radio', { name: nazwa }).filter({ visible: true }).first();

test('bez udostępnionej lokalizacji lista pokazuje okolicę Poznania', async ({ page }) => {
  // Zgody nie ma i NIE PYTAMY o nią przy wejściu — lista i tak ma coś nieść.
  await podstaw(page);
  await page.goto('/mapa?gry=0');

  await expect(widoczny(page, 'Obiekty')).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
  await expect(page.getByText('Orlik Rataje').first()).toBeVisible({ timeout: 15_000 });

  // Miast tu już nie ma — liczby z `fields.city` były nieprawdziwe.
  await expect(page.getByText('Albo wybierz miasto')).toHaveCount(0);
});

test('gdy nie ma czego dobrać, zostaje droga przez przycisk', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });
  // Katalog pusty: żadne zapytanie nie zwraca obiektów.
  await page.route('**/rest/v1/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'content-range': '0-0/0' }, body: '[]',
  }));
  await page.goto('/mapa?gry=0');

  await expect(page.getByRole('button', { name: /Pokaż boiska blisko mnie/ }))
    .toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Przybliż tam/ })).toBeVisible();
});
