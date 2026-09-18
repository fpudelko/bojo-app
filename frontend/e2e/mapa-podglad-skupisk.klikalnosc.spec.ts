import { test, expect, type Page } from '@playwright/test';

/**
 * REPRO: „nadal jakby za mało obiektów, bo pokazuję 800 albo mniej".
 *
 * Zgłoszone tego samego dnia co pierwsza poprawka liczników filtrów: przycisk
 * „Pokaż N boisk" w arkuszu, przy oddalonej mapie i bez wybranej miejscowości,
 * liczył z 15-kilometrowej listy startowej — czyli z ułamka tego, co widać na
 * mapie pod arkuszem. Ten test dowodzi, że liczy dziś sumę skupisk KADRU MAPY
 * (RPC `mapa_skupiska`), a NIE tej listy: atrapa RPC zwraca inną liczbę niż
 * atrapa listy startowej, więc pomyłka miejsca liczenia jest widoczna wprost
 * na ekranie, nie tylko w logice.
 */

/** Trzy boiska w Poznaniu — 15-km lista startowa. Licznik na przycisku NIE MA
 *  PRAWA zgadzać się z tą trójką — to jest właśnie stary, błędny licznik. */
const LISTA_STARTOWA = Array.from({ length: 3 }, (_, i) => ({
  id: `poz${i}`, name: `Orlik Poznań ${i}`, address: 'Poznań, Rataje',
  lat: 52.4064 + i * 0.002, lng: 16.9252 + i * 0.002,
  sport: ['piłka nożna'], venue_type: null, surface: 'beton',
}));

async function podstaw(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });
  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/rpc/mapa_skupiska')) {
      // Suma skupisk zależy od tego, JAKIE sporty przyszły w zapytaniu —
      // dokładnie tak samo, jak zależałaby od filtra na mapie. Wybór „Piłka
      // nożna" w arkuszu rozwija się do ['piłka nożna', 'futsal']
      // (`rozwinSporty`), czyli dwóch wartości; domyślne „wszystkie sporty"
      // mapy to siódemka. Rozróżniamy po długości, żeby nie zależeć od
      // dokładnej treści tablicy.
      const cialo = route.request().postDataJSON() as { p_sporty?: string[] };
      const ile = (cialo.p_sporty?.length ?? 0) <= 2 ? 380 : 884;
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ lat: 52.0, lng: 19.0, ile }]),
      });
    }
    if (url.includes('/fields') && url.includes('lat=gte')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': `0-${LISTA_STARTOWA.length - 1}/${LISTA_STARTOWA.length}` },
        body: JSON.stringify(LISTA_STARTOWA),
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });
}

test('przycisk w arkuszu filtrów liczy skupiska kadru mapy, nie 15-km listę startową', async ({ page }) => {
  await podstaw(page);
  // Bez lat/lng/z w adresie: mapa startuje na widoku całego kraju
  // (POLSKA_ZOOM = 6 < ZOOM_SKUPISK = 11), czyli w trybie skupisk — dokładnie
  // ten stan, w którym zgłoszono zbyt małe liczby.
  await page.goto('/mapa?gry=0');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: /Filtry/i }).filter({ visible: true }).first().click();

  const przycisk = page.getByRole('button', { name: /^Pokaż \d+ bois/i }).filter({ visible: true }).first();
  await expect(przycisk).toHaveText(/Pokaż 884 boiska/, { timeout: 10_000 });
  await expect(page.getByText('w tym widoku mapy').filter({ visible: true }).first()).toBeVisible();
  // Trójka z listy startowej NIE ma prawa pojawić się jako liczba na przycisku.
  await expect(przycisk).not.toHaveText(/Pokaż 3 /);

  await page.getByRole('button', { name: 'Piłka nożna' }).filter({ visible: true }).first().click();
  await expect(przycisk).toHaveText(/Pokaż 380 boisk$/, { timeout: 10_000 });
  await expect(page.getByText('w tym widoku mapy').filter({ visible: true }).first()).toBeVisible();
});

test('„Gry dziś" wraca do lokalnego licznika, bo skupiska nic nie wiedzą o meczach', async ({ page }) => {
  await podstaw(page);
  await page.goto('/mapa?gry=0');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: /Filtry/i }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /Gry dziś/i }).filter({ visible: true }).first().click();

  const przycisk = page.getByRole('button', { name: /^Pokaż \d+ bois/i }).filter({ visible: true }).first();
  // Bez meczów w atrapie zdarzeń lokalna lista startowa (trójka) filtruje się
  // do zera — inna liczba niż RPC (884/380), co dowodzi, że to inna ścieżka.
  await expect(przycisk).toHaveText(/Pokaż 0 boisk$/, { timeout: 10_000 });
  await expect(page.getByText('w Twojej okolicy (15 km), nie w całym katalogu').filter({ visible: true }).first())
    .toBeVisible();
});
