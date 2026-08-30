import { test, expect, type Page } from '@playwright/test';

/**
 * PRZYBLIŻENIE DO PUSTEGO KADRU NIE MOŻE KOŃCZYĆ SIĘ MILCZENIEM.
 *
 * Zgłoszone wprost z sesji QA: „mapa pustoszeje przy z≥17". Przy dużym
 * przybliżeniu `getExplorerFields()` dostaje ciasny prostokąt i słusznie wraca
 * pusty — ale efekt w `VenueExplorer.tsx` nadpisywał tym `allFields`, a CAŁA
 * reszta interfejsu miała wtedy dziurę:
 *   - pinezki znikały (poprawnie — nic tam nie ma),
 *   - pasek z licznikiem znikał, bo jego warunek brzmiał
 *     `fields.length > 0 || trybSkupisk`, a przy przybliżeniu oba są fałszem,
 *   - nie pokazywał się ŻADEN komunikat: jedyny istniejący („Brak boisk dla
 *     tych filtrów") wymagał `allFields.length > 0`, czyli sytuacji, w której
 *     serwer coś zwrócił, a wycięły to filtry. Pusty kadr po stronie serwera
 *     nie miał ani jednej gałęzi.
 *
 * Efekt: biała mapa bez jednego słowa wyjaśnienia i bez wyjścia. Dziś jest tam
 * komunikat i przycisk „Oddal", a licznik nad listą mówi, czego dotyczy.
 *
 * Atrapa PostgREST filtruje po `lat=gte.`/`lat=lte.` z adresu — tak jak robi to
 * serwer. Bez tego test niczego by nie sprawdzał: mapa dostawałaby boiska
 * niezależnie od przybliżenia i pusty kadr nigdy by nie powstał.
 */

const BOISKA = Array.from({ length: 3 }, (_, i) => ({
  id: `k${i}`, name: `Orlik Poznań ${i}`, address: 'Poznań, Rataje',
  lat: 52.4064 + i * 0.01, lng: 16.9252 + i * 0.01,
  sport: ['piłka nożna'], venue_type: 'orlik', surface: 'sztuczna',
  map_visibility: 'public',
}));

/** Wycinek pustego pola — 0.5° na wschód od wszystkich boisk. */
const PUSTO = { lat: 52.4064, lng: 17.6 };

function wKadrze(url: string) {
  const g = (k: string) => {
    const m = url.match(new RegExp(`${k}=(?:gte|lte)\\.(-?[0-9.]+)`));
    return m ? Number(m[1]) : null;
  };
  const latMin = Number(url.match(/lat=gte\.(-?[0-9.]+)/)?.[1] ?? NaN);
  const latMax = Number(url.match(/lat=lte\.(-?[0-9.]+)/)?.[1] ?? NaN);
  const lngMin = Number(url.match(/lng=gte\.(-?[0-9.]+)/)?.[1] ?? NaN);
  const lngMax = Number(url.match(/lng=lte\.(-?[0-9.]+)/)?.[1] ?? NaN);
  void g;
  if ([latMin, latMax, lngMin, lngMax].some(Number.isNaN)) return [];
  return BOISKA.filter((b) => b.lat >= latMin && b.lat <= latMax && b.lng >= lngMin && b.lng <= lngMax);
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
        body: JSON.stringify([{ lat: 52.4, lng: 16.92, ile: 3 }]),
      });
    }
    if (url.includes('/fields') && url.includes('lat=gte')) {
      const dane = wKadrze(url);
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': `0-${Math.max(dane.length - 1, 0)}/${dane.length}` },
        body: JSON.stringify(dane),
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });
}

test('pusty kadr przy przybliżeniu mówi, że jest pusty, i daje wyjście', async ({ page }) => {
  await podstaw(page);
  // z=17 nad polem, w którym nie ma ani jednego boiska z atrapy.
  await page.goto(`/mapa?gry=0&lat=${PUSTO.lat}&lng=${PUSTO.lng}&z=17`);
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });

  // Sedno: NIE milczymy. Bez poprawki nie renderowało się tu nic — ani pinezki,
  // ani licznik, ani komunikat. Nakładka nad mapą (telefon) i pusty stan listy
  // (desktop) niosą tę samą wiadomość innymi słowami, bo mają inną ilość
  // miejsca — bierzemy tę, która jest widoczna w tym oknie.
  await expect(
    page.getByText(/Tu nie ma boisk|W tym wycinku mapy nie ma żadnego boiska/)
      .filter({ visible: true }).first(),
  ).toBeVisible({ timeout: 15_000 });

  // …i jest czym się z tego wydostać. „Oddal mapę", nie „Oddal" — tak nazywa
  // się minus z `ZoomButtons`, który stoi w tym samym rogu.
  const oddal = page.getByRole('button', { name: 'Oddal mapę' }).filter({ visible: true }).first();
  await expect(oddal).toBeVisible();
  await oddal.click();

  // Po oddaleniu ślepy zaułek znika — o to w tym przycisku chodzi. Asercja na
  // ZNIKNIĘCIE, nie na konkretny tekst zastępczy: nakładka nad mapą („N boisk
  // w tym widoku") jest `md:hidden`, więc na desktopie po oddaleniu pojawia się
  // co innego niż na telefonie, a wspólne jest to, że pustki już nie ma.
  await expect(
    page.getByText(/Tu nie ma boisk|W tym wycinku mapy nie ma żadnego boiska/)
      .filter({ visible: true }),
  ).toHaveCount(0, { timeout: 15_000 });
});

test('licznik nad listą mówi, czego dotyczy jego liczba', async ({ page }, testInfo) => {
  // Lista obok mapy jest tylko od `md:` — na telefonie widok startuje jako
  // pełnoekranowa mapa i licznika nad listą nie ma na ekranie.
  test.skip(testInfo.project.name !== 'komputer', 'Lista obok mapy istnieje od md:');
  await podstaw(page);
  // Kadr obejmujący wszystkie trzy boiska.
  await page.goto('/mapa?gry=0&lat=52.4164&lng=16.9352&z=12');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });

  // Gołe „3 boiska" stało obok „N boisk w tym widoku" i liczby na kółku
  // skupiska — trzy liczniki bez podpisu czytały się jak trzy sprzeczne
  // odpowiedzi. Zgłoszone wprost.
  await expect(page.getByText(/boisk\w*\s+w tym kadrze mapy/).filter({ visible: true }).first())
    .toBeVisible({ timeout: 15_000 });
});
