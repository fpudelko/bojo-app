import { test, expect, type Page } from '@playwright/test';

/**
 * FILTR „MIEJSCOWOŚĆ + ILE KM".
 *
 * Zamówione wprost: „dodaj do filtra wybór miast albo miejscowości […] może
 * jest jakiś gotowy moduł, że miejscowość plus ile km".
 *
 * DLACZEGO PO WSPÓŁRZĘDNYCH, A NIE PO NAZWIE MIASTA W BAZIE. Filtr po
 * `fields.city` już raz odpadł: kolumna jest wypełniona w jakichś dwóch
 * procentach, więc mówiłaby „w Poznaniu 54 boiska" przy kilkuset. Tu
 * miejscowość służy wyłącznie do wyznaczenia PUNKTU, a dobór idzie po
 * odległości — `lat`/`lng` ma każdy obiekt w katalogu.
 *
 * Gotowym modułem jest Nominatim przez własne proxy `/api/geocode` (to samo,
 * którego używają pickery lokalizacji). W teście podstawiamy je `page.route()`,
 * żeby scenariusz nie zależał od cudzego serwera.
 */

const WROCLAW = { nazwa: 'Wrocław', kontekst: 'dolnośląskie', lat: 51.1079, lng: 17.0385 };

/** Boisko blisko Wrocławia — ma wejść na listę. */
const BLISKO = {
  id: 'w1', name: 'Orlik Wrocław Centrum', address: 'Wrocław, Stare Miasto',
  lat: 51.1100, lng: 17.0400, sport: ['piłka nożna'], venue_type: 'orlik', surface: 'artificial',
};

async function podstaw(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });

  await page.route('**/api/geocode**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('miejscowosc')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([WROCLAW]),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/rpc/mapa_skupiska')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ lat: 51.1, lng: 17.0, ile: 700 }]),
      });
    }
    if (url.includes('/fields') && url.includes('lat=gte')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': '0-0/1' }, body: JSON.stringify([BLISKO]),
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

test('wybór miejscowości z promieniem trafia do adresu i zawęża listę', async ({ page }) => {
  await podstaw(page);
  await page.goto('/mapa?gry=0');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Filtry/i }).filter({ visible: true }).first().click();
  await page.getByLabel('Miejscowość albo kod pocztowy').filter({ visible: true }).first()
    .fill('Wrocław');

  // Podpowiedź z geokodera — miejsce, nie dowolny adres.
  await page.getByRole('button', { name: /Wrocław/ }).filter({ visible: true }).first()
    .click({ timeout: 15_000 });

  // Po wyborze pojawia się promień; 25 km zamiast domyślnych 10.
  await page.getByRole('button', { name: '25 km', exact: true }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /^Pokaż \d+ boisk/i }).filter({ visible: true }).first().click();

  await page.waitForTimeout(1500);
  const p = new URL(page.url()).searchParams;
  expect(p.get('m')).toBe('Wrocław');
  expect(Number(p.get('mlat'))).toBeCloseTo(WROCLAW.lat, 2);
  expect(p.get('km')).toBe('25');

  await widoczny(page, 'Lista').click();
  await expect(page.getByText('Orlik Wrocław Centrum').filter({ visible: true }).first())
    .toBeVisible({ timeout: 15_000 });
});

test('kod pocztowy jest przyjmowany tak samo jak nazwa', async ({ page }) => {
  await podstaw(page);
  await page.goto('/mapa?gry=0');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Filtry/i }).filter({ visible: true }).first().click();
  const pole = page.getByLabel('Miejscowość albo kod pocztowy').filter({ visible: true }).first();
  await pole.fill('50-001');

  await expect(page.getByRole('button', { name: /Wrocław/ }).filter({ visible: true }).first())
    .toBeVisible({ timeout: 15_000 });
});

test('filtr miejscowości działa też na mecze, nie tylko na katalog', async ({ page }) => {
  await podstaw(page);
  // Tryb gier jest domyślny (bez `?gry=0`).
  await page.goto('/mapa');
  await expect(page.getByRole('button', { name: /Filtry/i }).filter({ visible: true }).first())
    .toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Filtry/i }).filter({ visible: true }).first().click();
  await expect(page.getByText('Gdzie szukam').filter({ visible: true }).first()).toBeVisible();
  await page.getByLabel('Miejscowość albo kod pocztowy').filter({ visible: true }).first()
    .fill('Wrocław');
  await page.getByRole('button', { name: /Wrocław/ }).filter({ visible: true }).first()
    .click({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Pokaż /i }).filter({ visible: true }).first().click();

  await page.waitForTimeout(1500);
  expect(new URL(page.url()).searchParams.get('m')).toBe('Wrocław');
});
