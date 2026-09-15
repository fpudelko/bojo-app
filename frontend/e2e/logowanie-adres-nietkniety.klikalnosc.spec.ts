import { test, expect, type Page } from '@playwright/test';

/**
 * EKRAN LOGOWANIA ZACHOWUJE SWÓJ WŁASNY ADRES.
 *
 * Pod formularzem logowania stoi PRAWDZIWA lista meczów
 * (`components/auth/LoginBackdrop.tsx` renderuje `EventsListView`) — to tło
 * pokazuje, co użytkownik dostanie po zalogowaniu. Gdy lista nauczyła się
 * trzymać filtry w adresie strony (2026-09-15), jej efekt synchronizujący
 * zaczął przepisywać adres KAŻDEJ strony, na której się zamontowała — czyli
 * także `/logowanie`. Parametry znikały:
 *
 *   * `mode=rejestracja` — przycisk „Dołącz" w pasku przestawał otwierać
 *     zakładanie konta i pokazywał formularz logowania,
 *   * `next` i `powod` — czyli cała droga powrotna po zalogowaniu.
 *
 * Złapały to dopiero zrzuty ekranu (`rejestracja-formularz` pokazał
 * formularz LOGOWANIA), a nie scenariusz zachowania — dlatego ten plik
 * istnieje. Chroni granicę, nie wygląd: adres ma zostać nietknięty, a widok
 * ma odpowiadać temu, co w nim stoi.
 */

async function podstaw(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });
  // Bez bazy — tło ma się wyrenderować jako pusta lista, nie zawiesić.
  await page.route('**/rest/v1/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'content-range': '0-0/0' }, body: '[]',
  }));
}

test('?mode=rejestracja zostaje w adresie i otwiera zakładanie konta', async ({ page }) => {
  await podstaw(page);
  await page.goto('/logowanie?mode=rejestracja');

  await expect(page.getByRole('button', { name: 'Załóż konto' }).first())
    .toBeVisible({ timeout: 15_000 });
  await expect(page.getByPlaceholder('Imię i nazwisko')).toBeVisible();

  // Tło listy montuje się z opóźnieniem — dajemy mu czas na przepisanie
  // adresu, żeby test nie przechodził przez wyścig, tylko przez poprawkę.
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).searchParams.get('mode')).toBe('rejestracja');
  await expect(page.getByPlaceholder('Imię i nazwisko')).toBeVisible();
});

test('next i powod przeżywają zamontowanie tła z listą', async ({ page }) => {
  await podstaw(page);
  const next = '/wydarzenia?sport=pi%C5%82ka%20no%C5%BCna&alert=1';
  await page.goto(`/logowanie?powod=alert&next=${encodeURIComponent(next)}`);

  // Powód wejścia widać w podtytule — to on tłumaczy, po co ktoś tu trafił.
  await expect(page.getByText(/powiadomienia o nowych meczach/i).first())
    .toBeVisible({ timeout: 15_000 });

  await page.waitForTimeout(1500);
  const p = new URL(page.url()).searchParams;
  expect(p.get('powod')).toBe('alert');
  expect(p.get('next')).toBe(next);
});
