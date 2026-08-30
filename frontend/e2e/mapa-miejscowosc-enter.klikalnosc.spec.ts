import { test, expect, type Page } from '@playwright/test';

/**
 * ENTER W POLU „MIEJSCOWOŚĆ" WYBIERA PIERWSZĄ PODPOWIEDŹ.
 *
 * Zgłoszone wprost z sesji QA: wpisanie miasta w filtr „miejscowość + ile km"
 * i naciśnięcie Enter nic nie robiło — trzeba było kliknąć podpowiedź myszą
 * albo palcem. Pole nie miało żadnego `onKeyDown`, więc klawiatura nie miała
 * jak wybrać wyniku.
 */

async function podstaw(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });
  await page.route('**/api/geocode**', (route) => {
    const url = route.request().url();
    if (url.includes('miejscowosc=')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([
          { nazwa: 'Kraków', kontekst: 'małopolskie', lat: 50.0614, lng: 19.9366 },
        ]),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/rest/v1/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'content-range': '0-0/0' }, body: '[]',
  }));
}

test('Enter w polu miejscowości wybiera pierwszą podpowiedź', async ({ page }) => {
  await podstaw(page);
  await page.goto('/mapa?gry=0');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Filtry/i }).filter({ visible: true }).first().click();

  const pole = page.getByLabel('Miejscowość albo kod pocztowy').filter({ visible: true }).first();
  await expect(pole).toBeVisible({ timeout: 15_000 });
  await pole.fill('Krak');
  await expect(page.getByText('Kraków').filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });

  await pole.press('Enter');

  // Wybrana miejscowość zamienia pole tekstowe na chip z nazwą + promień.
  await expect(page.getByText('Kraków').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^\d+ km$/ }).filter({ visible: true }).first())
    .toBeVisible();
});
