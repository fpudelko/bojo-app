import { test, expect, type Page } from '@playwright/test';

/**
 * SYSTEMOWE „WSTECZ" Z ZAKŁADKI ROZMOWA WRACA DO ZAKŁADKI „MECZ", NIE Z APKI.
 *
 * Zgłoszone wprost, z sesji QA: „wejdź na mecz → zakładka Rozmowa → systemowe
 * wstecz. Jest: pusta strona (about:blank) — historia nie ma wpisu dla
 * zakładki. Powinno: powrót do zakładki Mecz."
 *
 * Mechanizm: `goToTab()` przełączał zakładki przez `history.replaceState()`,
 * który NIGDY nie dokłada wpisu do historii — nadpisuje bieżący. Kliknięcie
 * „Rozmowa" nie zostawiało więc śladu „byłem na Mecz" w historii przeglądarki;
 * systemowe „wstecz" szło o wpis DALEJ, niż użytkownik naprawdę wszedł.
 *
 * Naprawa: pierwsze zejście z zakładki „Mecz" (domyślnej) dokłada JEDEN wpis
 * przez `pushState`; kolejne przełączenia (i swipe) dalej idą przez
 * `replaceState`, żeby szybkie przewijanie zakładek nie zasypało historii.
 * Osobny słuchacz `popstate` synchronizuje widoczną zakładkę z adresem, gdy
 * ten wpis zostanie użyty.
 */

const SESJA = {
  access_token: 'fake-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'fake-refresh',
  user: {
    id: 'org-1',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'organizator@example.com',
    email_confirmed_at: '2025-01-01T10:00:00.000Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: 'Organizator' },
    created_at: '2025-01-01T10:00:00.000Z',
    updated_at: '2025-01-01T10:00:00.000Z',
  },
};

const dzien = (o: number) => {
  const d = new Date(); d.setDate(d.getDate() + o);
  return d.toISOString().slice(0, 10);
};

const MECZ = {
  id: 'e1', organizer_id: 'org-1', organizer_name: 'Organizator', sport: 'piłka nożna',
  field_id: null, field_name: 'Orlik testowy', lat: 52.4, lng: 16.9,
  title: 'Testowy mecz', description: null, event_date: dzien(1), event_time: '19:00:00', end_time: null,
  max_players: 14, min_players: null, visibility: 'public', status: 'active',
  created_at: new Date().toISOString(), cost_grosz: 0, team_mode: 'brak',
  track_payments: false, show_payment_status: false, track_results: false,
  confirmation_deadline_h: 24, teams_published: false, allow_guest_adds: false,
  join_code: 'ABC123', require_approval: false, max_goalkeepers: 2,
  goalkeeper_slots_reserved: true, goalkeepers_enabled: false,
  reserve_claim_minutes: 180, reserve_enabled: true, require_sms_confirmation: false,
  field_address: null, event_blik: null,
};

async function podstaw(page: Page) {
  await page.addInitScript((sesja) => {
    try {
      localStorage.setItem('bojo_cookie_consent_v1', '1');
      localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(sesja));
    } catch { /* tryb prywatny */ }
  }, SESJA);

  await page.route('**/auth/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESJA) }));

  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    const jednakowy = (route.request().headers()['accept'] ?? '').includes('pgrst.object');
    if (url.includes('/events') && url.includes('id=eq.e1') && jednakowy) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MECZ) });
    }
    if (jednakowy) {
      return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116' }) });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });
}

test('wstecz z Rozmowy wraca do zakładki Mecz na tej samej stronie', async ({ page }) => {
  await podstaw(page);

  // Prawdziwa strona PRZED meczem — tak jak realne wejście z listy, nie
  // bezpośredni `goto` na mecz (inaczej test niczego by nie sprawdzał: bez
  // wcześniejszego wpisu w historii KAŻDE „wstecz" prowadzi poza aplikację,
  // z tym błędem czy bez niego).
  await page.goto('/wydarzenia');
  await page.goto('/wydarzenia/e1');

  const zakladkaMecz = page.getByRole('button', { name: 'Mecz', exact: true }).filter({ visible: true }).first();
  await expect(zakladkaMecz).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Testowy mecz').filter({ visible: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Rozmowa', exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/tab=rozmowa/);

  await page.goBack();

  // Zostajemy NA MECZU, na zakładce „Mecz" — nie about:blank, nie inna strona.
  await expect(page).toHaveURL(/\/wydarzenia\/e1$/);
  await expect(page.getByText('Testowy mecz').filter({ visible: true }).first()).toBeVisible();

  // Drugie „wstecz" ma dopiero wtedy opuścić stronę meczu.
  await page.goBack();
  await expect(page).toHaveURL(/\/wydarzenia$/);
});
