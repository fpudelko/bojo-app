import { test, expect, type Page } from '@playwright/test';

/**
 * ROZMOWA OTWARTA Z LISTY ROZMÓW ZOSTAJE OZNACZONA JAKO PRZECZYTANA.
 *
 * Zgłoszone wprost: „ciągle dostaję info, że mam 2 niewyświetlone wiadomości,
 * mimo że je wyświetliłem, a nawet na nie odpisałem".
 *
 * Mechanizm: licznik nieprzeczytanych liczy się ze znacznika „widziano"
 * w `localStorage` (`kluczRozmowyWidziano` / `kluczTablicaWidziano`), a
 * znacznik zapisywały WYŁĄCZNIE zakładki na stronie meczu i na stronie ekipy.
 * Trasy `/rozmowy/mecz/[id]` i `/rozmowy/grupa/[id]` — czyli te, którymi
 * wchodzi się z listy rozmów, a więc po powiadomieniu — nie zapisywały go
 * wcale. Rozmowa przeczytana tą drogą zostawała nieprzeczytana na zawsze.
 *
 * Sedno jest w `localStorage`, nie na ekranie, więc test czyta znacznik
 * wprost: jego BRAK był całym błędem. `RozmowyClient` odświeża listę przy
 * powrocie na kartę i już wcześniej zakładał, że ten znacznik istnieje.
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

/** Mecz, w którym zalogowany jest ORGANIZATOREM — `RozmowaMeczuClient`
 *  przepuszcza wtedy do rozmowy bez pytania o `event_participants`. */
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
    // Atrapa PostgREST musi kłamać jak serwer: `.single()` przy zerze wierszy
    // dostaje 406 PGRST116, nie pustą tablicę.
    if (jednakowy) {
      return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116' }) });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });
}

test('rozmowa meczu otwarta z listy zapisuje znacznik „widziano"', async ({ page }) => {
  await podstaw(page);
  await page.goto('/rozmowy/mecz/e1');

  // Nagłówek rozmowy = rozmowa naprawdę się otworzyła (a nie „to nie dla Ciebie”).
  await expect(page.getByText('Testowy mecz').first()).toBeVisible({ timeout: 15_000 });

  const znacznik = await page.evaluate(() => localStorage.getItem('bojo:rozmowa-widziano:e1'));
  expect(znacznik, 'brak znacznika „widziano" po otwarciu rozmowy').toBeTruthy();
  expect(Number.isNaN(Date.parse(znacznik ?? '')), 'znacznik nie jest datą ISO').toBe(false);
});

test('wyjście z rozmowy odświeża znacznik — wiadomość z czasu czytania też jest przeczytana', async ({ page }) => {
  await podstaw(page);
  await page.goto('/rozmowy/mecz/e1');
  await expect(page.getByText('Testowy mecz').first()).toBeVisible({ timeout: 15_000 });

  const przy_wejsciu = await page.evaluate(() => localStorage.getItem('bojo:rozmowa-widziano:e1'));

  // Zegar w znaczniku ma rozdzielczość milisekundy — bez tej przerwy obie
  // wartości mogłyby wyjść identyczne i asercja nie mówiłaby nic.
  await page.waitForTimeout(50);

  // „Wróć" w nagłówku, NIE `page.goto` — wyjście musi być nawigacją WEWNĄTRZ
  // aplikacji. Twarde przeładowanie burzy kontekst JS, więc React nie zdąży
  // uruchomić sprzątania efektu i test sprawdzałby przeglądarkę, nie kod.
  await page.getByRole('button', { name: 'Wróć' }).click();
  await expect(page).toHaveURL(/\/rozmowy$/);

  const po_wyjsciu = await page.evaluate(() => localStorage.getItem('bojo:rozmowa-widziano:e1'));
  expect(Date.parse(po_wyjsciu ?? '')).toBeGreaterThan(Date.parse(przy_wejsciu ?? ''));
});
