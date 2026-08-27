import { test, expect, type Page } from '@playwright/test';

/**
 * SZUKANIE NA MAPIE ZDEJMUJE KÓŁKA ZE SKUPISKAMI.
 *
 * Zgłoszone wprost: „po wyszukaniu np. »poznan« w widoku mapy nie działa
 * rozbijanie zgrupowanych pinesek i w ogóle całość się pierdoli".
 *
 * Mechanizm: mapa ma DWA różne grupowania, których użytkownik nie odróżnia.
 *  • `WarstwaSkupisk` — kółka z liczbami z RPC `mapa_skupiska`, liczone przez
 *    bazę dla oddalonego kadru. Kliknięcie PRZYBLIŻA (`flyTo`), nic nie rozbija.
 *  • `L.markerClusterGroup` w `MapLayer` — liczone w przeglądarce z realnych
 *    pinezek. Kliknięcie ROZBIJA (spiderfy) albo dopasowuje kadr.
 *
 * Efekt pobierający dane dla kadru wychodzi wcześniej, gdy trwa szukanie
 * (szukanie ma własne źródło), więc `skupiska` zostawało z ostatniego widoku
 * kraju, a `WarstwaSkupisk` renderowała się bezwarunkowo. Po wpisaniu miasta
 * mapa doleciała do wyników — i na wynikach leżały kółka sprzed szukania.
 * Kliknięcie takiego kółka robi `flyTo(zoom + 3, max 14)`: przy przybliżeniu
 * 15 po wynikach szukania mapa się ODDALA. Stąd „całość się pierdoli".
 */

const ILE_W_SKUPISKU = 1240;

/** Boiska „w Poznaniu" — tak blisko siebie, że markercluster je zgrupuje. */
const WYNIKI = Array.from({ length: 6 }, (_, i) => ({
  id: `f${i}`, name: `Orlik Poznań ${i}`, address: 'Poznań, os. Piastowskie',
  lat: 52.4064 + i * 0.0004, lng: 16.9252 + i * 0.0004,
  sport: ['piłka nożna'], venue_type: 'orlik', surface: 'sztuczna',
}));

async function podstaw(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });
  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/rpc/mapa_skupiska')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ lat: 52.4, lng: 16.92, ile: ILE_W_SKUPISKU }]),
      });
    }
    if (url.includes('/fields')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': `0-${WYNIKI.length - 1}/${WYNIKI.length}` },
        body: JSON.stringify(WYNIKI),
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

test('wpisanie miasta zdejmuje kółka skupisk sprzed szukania', async ({ page }) => {
  await podstaw(page);
  await page.goto('/mapa?gry=0');
  await widoczny(page, 'Mapa').click();
  await expect(page.locator('.leaflet-container')).toBeVisible();

  // Kadr startowy jest oddalony, więc baza oddaje kółko z liczbą.
  const skupisko = page.locator('.leaflet-marker-icon').getByText(String(ILE_W_SKUPISKU));
  await expect(skupisko).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder('Nazwa boiska albo adres').filter({ visible: true }).first()
    .fill('poznan');

  // Kółko sprzed szukania MUSI zniknąć: leżało na wynikach i przy kliknięciu
  // oddalało mapę zamiast rozbić grupę.
  await expect(skupisko).toHaveCount(0, { timeout: 15_000 });

  // ...a na jego miejscu jest grupa liczona w przeglądarce — ta, którą klik
  // naprawdę rozbija.
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15_000 });
});
