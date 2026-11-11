import { test, expect } from '@playwright/test';

/**
 * „UTWÓRZ TURNIEJ" NIE LEŻY POD BANEREM COOKIES.
 *
 * Audyt 7 (2026-11-11, telefon 360 × 800): przycisk na dole kreatora turnieju
 * przykrywał baner „Informacja o cookies" razem z dolnym menu, więc dotyk
 * trafiał w baner. Baner jest `fixed`, a strona nie rezerwowała na niego
 * miejsca. Dziś `CookieBanner` wystawia swoją wysokość w `--cookie-h`,
 * a `<body>` dostaje tyle dopełnienia (`globals.css`).
 *
 * Test NIE ustawia zgody na cookies, w przeciwieństwie do reszty pakietu:
 * chodzi dokładnie o stan, w którym baner jest na ekranie.
 */

const SESJA = {
  access_token: 'fake-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'fake-refresh',
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.com',
    email_confirmed_at: '2025-01-01T10:00:00.000Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: 'Jan Testowy' },
    created_at: '2025-01-01T10:00:00.000Z',
    updated_at: '2025-01-01T10:00:00.000Z',
  },
};

test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });

test('przycisk „Utwórz turniej" jest dotykalny przy widocznym banerze cookies', async ({ page }) => {
  await page.addInitScript((sesja) => {
    try { localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(sesja)); } catch { /* tryb prywatny */ }
  }, SESJA);
  await page.route('**/auth/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESJA) }));
  await page.route('**/rest/v1/**', (route) => {
    if ((route.request().headers()['accept'] ?? '').includes('pgrst.object')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: SESJA.user.id, display_name: 'Jan Testowy' }),
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });

  await page.goto('/turnieje/nowe');
  const przycisk = page.getByRole('button', { name: 'Utwórz turniej' });
  await expect(przycisk).toBeVisible({ timeout: 15_000 });

  // Baner pokazuje się po przewinięciu za pierwszy ekran.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const baner = page.getByRole('dialog', { name: 'Informacja o cookies' });
  await expect(baner).toBeVisible({ timeout: 10_000 });
  // Dopełnienie liczy się po pokazaniu banera; przewijamy jeszcze raz na sam dół.
  await page.waitForFunction(() => document.documentElement.dataset.cookieBaner === '1');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  const pudelkoPrzycisku = await przycisk.boundingBox();
  const pudelkoBanera = await baner.boundingBox();
  expect(pudelkoPrzycisku).not.toBeNull();
  expect(pudelkoBanera).not.toBeNull();
  // Cały przycisk nad banerem i co najmniej 44 px wysokości.
  expect(pudelkoPrzycisku!.y + pudelkoPrzycisku!.height).toBeLessThanOrEqual(pudelkoBanera!.y);
  expect(pudelkoPrzycisku!.height).toBeGreaterThanOrEqual(44);

  // Środek przycisku należy do przycisku, nie do banera ani menu.
  const trafia = await przycisk.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cel = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!cel && el.contains(cel);
  });
  expect(trafia).toBe(true);
});
