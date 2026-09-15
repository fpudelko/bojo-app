import { test, expect, type Page } from '@playwright/test';

/**
 * FILTRY LISTY MECZÓW ŻYJĄ W ADRESIE STRONY.
 *
 * Zgłoszone w przeglądzie powiadomień (15.09.2026) jako dwa błędy, które
 * okazały się jednym brakiem:
 *
 *   * „kliknięcie «Powiadom mnie» gubi wszystko" — wylogowany szedł na
 *     logowanie i wracał na GOŁĄ listę, bez filtrów i bez powodu, dla którego
 *     tam kliknął,
 *   * „filtry nie przeżywają odświeżenia ani powrotu" — nie dało się wysłać
 *     komuś linku do „piłka, dzisiaj, do 5 km".
 *
 * Scenariusz sprawdza to, czego nie widzi Vitest: czy adres NAPRAWDĘ zmienia
 * się pod palcem i czy po przeładowaniu strona wraca do tych samych filtrów.
 */

const MECZE = [
  {
    id: 'e1', title: 'Piłka nożna 7v7', sport: 'piłka nożna',
    date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), time: '18:00',
    max_players: 14, participants_count: 8, cost_grosz: 0, field_name: 'Orlik Rataje',
    lat: 52.39, lng: 16.95, status: 'open', visibility: 'public',
    created_at: new Date().toISOString(),
  },
];

async function podstaw(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });
  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/events')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': '0-0/1' }, body: JSON.stringify(MECZE),
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });
}

const widoczny = (page: Page, nazwa: string | RegExp) =>
  page.getByRole('button', { name: nazwa }).filter({ visible: true }).first();

test('wybrany sport ląduje w adresie i przeżywa odświeżenie', async ({ page }) => {
  await podstaw(page);
  await page.goto('/wydarzenia');
  await expect(widoczny(page, /Filtry/i)).toBeVisible({ timeout: 15_000 });

  await widoczny(page, /Filtry/i).click();
  await widoczny(page, 'Piłka nożna').click();
  await widoczny(page, /^Pokaż \d+ mecz/i).click();
  await page.waitForTimeout(800);

  // Adres niesie sport — i to tym samym parametrem co `/mapa`.
  expect(new URL(page.url()).searchParams.get('sport')).toBe('piłka nożna');

  // Odświeżenie NIE czyści filtrów: to jest cała rzecz, o którą chodzi.
  await page.reload();
  await expect(widoczny(page, /Filtry/i)).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).searchParams.get('sport')).toBe('piłka nożna');
});

test('wejście z gotowym adresem od razu ma te filtry', async ({ page }) => {
  // Druga połowa obietnicy „da się wysłać komuś link": adres przyniesiony
  // z zewnątrz musi ustawić filtry, a nie tylko dać się zapisać.
  await podstaw(page);
  await page.goto('/wydarzenia?sport=piłka%20nożna&kiedy=trzy-dni');
  await expect(widoczny(page, /Filtry/i)).toBeVisible({ timeout: 15_000 });

  await widoczny(page, /Filtry/i).click();
  await expect(page.getByText('Najbliższe 3 dni').filter({ visible: true }).first())
    .toBeVisible({ timeout: 10_000 });
  // Adres zostaje nietknięty — odczyt nie może go po cichu przepisać.
  expect(new URL(page.url()).searchParams.get('kiedy')).toBe('trzy-dni');
});

test('wylogowany klikający „Powiadom mnie" niesie filtry i powód na logowanie', async ({ page }) => {
  await podstaw(page);
  await page.goto('/wydarzenia?sport=piłka%20nożna');
  await expect(widoczny(page, /Filtry/i)).toBeVisible({ timeout: 15_000 });

  await widoczny(page, /Filtry/i).click();
  await widoczny(page, /Powiadom mnie o takich meczach/i).click();
  await page.waitForURL(/\/logowanie/, { timeout: 15_000 });

  const p = new URL(page.url()).searchParams;
  expect(p.get('powod')).toBe('alert');
  const next = p.get('next') ?? '';
  // Filtry jadą dalej RAZEM z zamiarem — bez jednego i drugiego powrót
  // z logowania kończył się gołą listą i zapomnianym powodem.
  expect(next).toContain('sport=');
  expect(next).toContain('alert=1');

  // I ekran logowania mówi, po co ktoś tu trafił.
  await expect(page.getByText(/powiadomienia o nowych meczach/i).first())
    .toBeVisible({ timeout: 10_000 });
});
