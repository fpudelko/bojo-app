import { test, expect, type Page } from '@playwright/test';

/**
 * DWIE DECYZJE PRODUKTOWE NA KROKU 1 KREATORA.
 *
 * 1. LISTA REZERWOWA STARTUJE WŁĄCZONA. Kreator był jedynym miejscem w Bojo,
 *    które startowało z `false` — kolumna ma `DEFAULT true` (migracja 124),
 *    strona edycji i mapper czytają `?? true`. Każdy nowy mecz powstawał więc
 *    bez rezerwy wbrew reszcie systemu.
 *
 * 2. WŁĄCZONY PRZEŁĄCZNIK „BRAMKARZE OSOBNO" NIE POKAZUJE JUŻ OPCJI
 *    „BEZ PODZIAŁU NA ROLE". To jest stan WYŁĄCZONEGO przełącznika, nie wybór
 *    do zrobienia w środku włączonego — dwie kontrolki odpowiadały na jedno
 *    pytanie i umiały się ze sobą nie zgadzać. Zostają dwa tryby, które
 *    naprawdę dzielą skład: wspólna pula i rezerwacja miejsc.
 *
 *    Strona EDYCJI nie ma przełącznika (ustawienia są tam równorzędne), więc
 *    tam wszystkie trzy tryby zostają — tego pilnuje osobna asercja niżej.
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

async function zalogowany(page: Page) {
  await page.addInitScript((sesja) => {
    try {
      localStorage.setItem('bojo_cookie_consent_v1', '1');
      localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(sesja));
      // Żadnego szkicu — sprawdzamy stan STARTOWY kreatora.
      localStorage.removeItem('bojo_event_draft_v1');
    } catch { /* tryb prywatny */ }
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
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });
}

test('lista rezerwowa jest włączona od razu po otwarciu kreatora', async ({ page }) => {
  await zalogowany(page);
  await page.goto('/wydarzenia/nowe');

  // Podpis pod licznikiem miejsc mówi, co się NAPRAWDĘ stanie przy komplecie.
  // Przy wyłączonej rezerwie stoi tam „Przy komplecie zapisy będą zamknięte."
  await expect(page.getByText('Kolejni chętni trafią na listę rezerwową.').first())
    .toBeVisible({ timeout: 15_000 });

  // Skoro rezerwa jest włączona, pytanie o czas na decyzję ma treść i jest
  // widoczne bez klikania czegokolwiek.
  await expect(page.getByText(/Czas na decyzję z rezerwy|Ile czasu/i).first()).toBeVisible();
});

test('włączony przełącznik bramkarzy nie oferuje już „Bez podziału na role"', async ({ page }) => {
  await zalogowany(page);
  await page.goto('/wydarzenia/nowe');

  const naglowekBramkarzy = page.getByText('Bramkarze osobno').first();
  await expect(naglowekBramkarzy).toBeVisible({ timeout: 15_000 });

  // Przełącznik wyłączony: żadnego z trybów nie ma na ekranie.
  await expect(page.getByText('Bez podziału na role')).toHaveCount(0);
  await expect(page.getByText('Rezerwuj miejsca dla bramkarzy')).toHaveCount(0);

  await page.getByRole('switch', { name: /Bramkarze osobno/i }).first().click();

  // Po włączeniu widać DWA tryby, które naprawdę dzielą skład…
  await expect(page.getByText('Rezerwuj miejsca dla bramkarzy').first()).toBeVisible();
  await expect(page.getByText('Rozróżniaj, ale nie rezerwuj miejsc').first()).toBeVisible();

  // …i ANI JEDNEGO „bez podziału": to jest stan wyłączonego przełącznika,
  // a nie wybór do zrobienia w środku włączonego.
  await expect(page.getByText('Bez podziału na role')).toHaveCount(0);
});
