import { test, expect, type Page } from '@playwright/test';

/**
 * REPRO: „pinezki znikają, filtry się resetują".
 *
 * Dwie osobne rzeczy, obie zgłoszone jednym zdaniem — dlatego dwa testy.
 */

/** Boiska w Krakowie — to ICH oczekujemy, wchodząc na mapę nad Krakowem. */
const KRAKOW = Array.from({ length: 3 }, (_, i) => ({
  id: `k${i}`, name: `Orlik Kraków ${i}`, address: 'Kraków, Nowa Huta',
  lat: 50.0614 + i * 0.002, lng: 19.9366 + i * 0.002,
  sport: ['piłka nożna'], venue_type: 'orlik', surface: 'sztuczna',
}));

/** Boiska w Poznaniu — lista startowa dobiera je, gdy nie wiemy, gdzie stoi
 *  gracz. NIE MAJĄ prawa zastąpić pinezek nad Krakowem. */
const POZNAN = Array.from({ length: 3 }, (_, i) => ({
  id: `p${i}`, name: `Orlik Poznań ${i}`, address: 'Poznań, Rataje',
  lat: 52.4064 + i * 0.002, lng: 16.9252 + i * 0.002,
  sport: ['koszykówka'], venue_type: 'orlik', surface: 'beton',
}));

/** Który kadr pytamy — po granicach w zapytaniu poznajemy miasto. */
function dlaKadru(url: string) {
  const m = url.match(/lat=gte\.([0-9.]+)/);
  if (!m) return [];
  return Number(m[1]) > 51.5 ? POZNAN : KRAKOW;
}

async function podstaw(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });
  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/rpc/mapa_skupiska')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ lat: 50.06, lng: 19.93, ile: 900 }]),
      });
    }
    if (url.includes('/fields') && url.includes('lat=gte')) {
      const dane = dlaKadru(url);
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': `0-${dane.length - 1}/${dane.length}` },
        body: JSON.stringify(dane),
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

test('mapa nad Krakowem pokazuje boiska z Krakowa, nie listę startową z Poznania', async ({ page }) => {
  await podstaw(page);
  // Wejście z kadrem na Krakowie. Lista startowa i tak się dobiera, bo `zoom`
  // startuje z widoku kraju, zanim Leaflet zgłosi ten z adresu.
  await page.goto('/mapa?gry=0&lat=50.06140&lng=19.93660&z=13');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500);

  // Na mapie mają być pinezki krakowskie…
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15_000 });
  // …a lista obok ma mówić o Krakowie, nie o Poznaniu.
  await widoczny(page, 'Lista').click();
  await expect(page.getByText('Orlik Kraków 0').filter({ visible: true }).first())
    .toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Orlik Poznań/)).toHaveCount(0);
});

test('zatwierdzenie kilku filtrów naraz nie gubi żadnego z nich', async ({ page }) => {
  await podstaw(page);
  await page.goto('/mapa?gry=0&lat=50.06140&lng=19.93660&z=13');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: /Filtry/i }).filter({ visible: true }).first().click();

  // Dwa filtry z RÓŻNYCH sekcji arkusza — o to właśnie chodzi. Każdy z nich
  // szedł osobnym `updateParams`, a te budowały adres z tego samego,
  // nieodświeżonego `searchParams`, więc zostawał wyłącznie ostatni.
  await page.getByRole('button', { name: 'piłka nożna' }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: 'sztuczna' }).filter({ visible: true }).first().click();
  // „Pokaż N boisk", nie „Pokaż moją okolicę" — ta druga siedzi na mapie.
  await page.getByRole('button', { name: /^Pokaż \d+ boisk/i }).filter({ visible: true }).first().click();

  await page.waitForTimeout(1500);
  // W adresie siedzą KODY nawierzchni ('artificial'), a 'sztuczna' to tylko
  // etykieta z `surfaceLabel()` — dlatego sprawdzamy obecność, nie treść.
  const p = new URL(page.url()).searchParams;
  expect(p.getAll('sport')).toContain('piłka nożna');
  expect(p.getAll('surface').length).toBeGreaterThan(0);
});
