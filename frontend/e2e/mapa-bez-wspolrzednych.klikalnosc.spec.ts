import { test, expect, type Page } from '@playwright/test';

/**
 * MECZ BEZ WSPÓŁRZĘDNYCH — na liście jest, na mapie go nie ma.
 *
 * Zgłoszone wprost: „na mapie nie wyświetla meczów, są na liście, na mapie
 * pusto". Mechanizm: `GamesMarkersLayer` pomija wiersz bez `lat`/`lng`, bo
 * pinezka nie ma gdzie stanąć — a licznik w rogu brał `rows.length`, więc nad
 * PUSTĄ mapą stało „12 meczy na mapie". Brak danych czytał się jak zepsuta mapa.
 *
 * Ten test pilnuje trzech rzeczy naraz, bo dopiero razem dają zrozumiały ekran:
 *   1. mecz przypięty do obiektu z katalogu trafia na mapę, nawet gdy sam nie
 *      ma współrzędnych (fallback do `fields.lat/lng` w `toEvent()`),
 *   2. licznik liczy PINEZKI, nie wiersze, i mówi wprost, ile meczów nie ma
 *      lokalizacji,
 *   3. mapa bez ani jednej pinezki tłumaczy, dlaczego jest pusta.
 *
 * Chodzi na atrapie PostgREST (`page.route`), bez bazy — ścieżka kodu
 * w aplikacji jest prawdziwa, podstawiona jest wyłącznie odpowiedź serwera.
 */

const dzien = (o: number) => {
  const d = new Date(); d.setDate(d.getDate() + o);
  return d.toISOString().slice(0, 10);
};

function mecz(
  id: string,
  title: string,
  wspolrzedne: { lat: number | null; lng: number | null },
  obiekt: { district: string; lat: number; lng: number } | null = null,
) {
  return {
    id, organizer_id: 'org-1', organizer_name: 'Organizator', sport: 'piłka nożna',
    field_id: obiekt ? 'field-1' : null, field_name: 'Orlik testowy',
    lat: wspolrzedne.lat, lng: wspolrzedne.lng,
    title, description: null, event_date: dzien(2), event_time: '19:00:00', end_time: null,
    max_players: 10, min_players: null, visibility: 'public', status: 'active',
    created_at: new Date().toISOString(), cost_grosz: 0, team_mode: 'brak',
    track_payments: false, show_payment_status: false, track_results: false,
    confirmation_deadline_h: 24, teams_published: false, allow_guest_adds: false,
    join_code: 'ABC123', require_approval: false, max_goalkeepers: 2,
    goalkeeper_slots_reserved: true, goalkeepers_enabled: false,
    reserve_claim_minutes: 180, require_sms_confirmation: false,
    event_participants: [], fields: obiekt,
  };
}

async function podstawMecze(page: Page, mecze: unknown[]) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });
  await page.route('**/rest/v1/**', (route) => {
    // `.single()` dostaje 406 PGRST116, tak jak od prawdziwego PostgRESTa —
    // pusta tablica jest tu gorsza niż błąd (patrz pułapka w AGENTS.md).
    if ((route.request().headers()['accept'] ?? '').includes('pgrst.object')) {
      return route.fulfill({
        status: 406,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'no rows' }),
      });
    }
    const body = route.request().url().includes('/events') ? JSON.stringify(mecze) : '[]';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-0/${mecze.length}` },
      body,
    });
  });
}

async function pokazMape(page: Page) {
  await page.getByRole('button', { name: 'Pokaż na mapie' }).first().click();
  await expect(page.getByText(/na mapie/).first()).toBeVisible();
}

test('mecz przy obiekcie z katalogu trafia na mapę bez własnych współrzędnych', async ({ page }) => {
  await podstawMecze(page, [
    mecz('a1', 'Ma własne współrzędne', { lat: 52.4064, lng: 16.9252 }),
    mecz('b2', 'Bierze je z obiektu', { lat: null, lng: null }, { district: 'Jeżyce', lat: 52.41, lng: 16.90 }),
    mecz('c3', 'Nie ma żadnych', { lat: null, lng: null }),
  ]);

  await page.goto('/wydarzenia');
  await expect(page.getByText('Nie ma żadnych')).toBeVisible({ timeout: 15_000 });
  await pokazMape(page);

  // Dwie pinezki: własne współrzędne + te odziedziczone po obiekcie.
  // Trzeci mecz nie ma się z czego wziąć i licznik mówi to wprost.
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);
  await expect(page.getByText(/2 mecze na mapie/)).toBeVisible();
  await expect(page.getByText(/1 bez lokalizacji/)).toBeVisible();

  // Skład na pinezce: pytanie „czy jest tam jeszcze miejsce" ma mieć odpowiedź
  // BEZ dotykania pinezki. Atrapa oddaje pusty skład, więc 0 z 10.
  await expect(page.locator('.leaflet-marker-icon').first()).toContainText('0/10');
});

test('mapa bez ani jednej pinezki tłumaczy, dlaczego jest pusta', async ({ page }) => {
  await podstawMecze(page, [
    mecz('a1', 'Pierwszy bez lokalizacji', { lat: null, lng: null }),
    mecz('b2', 'Drugi bez lokalizacji', { lat: null, lng: null }),
  ]);

  await page.goto('/wydarzenia');
  await expect(page.getByText('Pierwszy bez lokalizacji')).toBeVisible({ timeout: 15_000 });
  await pokazMape(page);

  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);
  await expect(page.getByText(/nie ma podanej lokalizacji/)).toBeVisible();
  await expect(page.getByText('Na liście są wszystkie.')).toBeVisible();
});
