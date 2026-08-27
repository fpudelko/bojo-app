import { test, expect, type Page } from '@playwright/test';

/**
 * KADR STARTOWY MAPY MECZÓW pokazuje wszystkie mecze, nie punkt między nimi.
 *
 * Zgłoszone wprost: „jak wejdę w mapę wydarzeń, to przybliża w miejscu, które
 * jest pomiędzy meczami, z mocnym przybliżeniem".
 *
 * Mechanizm: `VenueExplorer` trzyma mapę zamontowaną, ale z `display: none`,
 * gdy wybrany jest widok „Lista" (żeby nie gubić kadru). Leaflet mierzy wtedy
 * kontener jako 0×0, a `fitBounds` na zerowym kontenerze liczy MAKSYMALNE
 * przybliżenie i środek prostokąta — czyli dokładnie „punkt pomiędzy meczami".
 * Po przełączeniu na mapę `invalidateSize()` naprawiało rozmiar, ale nikt nie
 * powtarzał dopasowania.
 */

const dzien = (o: number) => {
  const d = new Date(); d.setDate(d.getDate() + o);
  return d.toISOString().slice(0, 10);
};

/** Dwa mecze po przeciwnych stronach Polski — kadr obejmujący oba MUSI być
 *  oddalony. Jeśli test zobaczy duże przybliżenie, znaczy, że mapa dopasowała
 *  się do zerowego kontenera. */
function mecz(id: string, title: string, lat: number, lng: number) {
  return {
    id, organizer_id: 'org-1', organizer_name: 'Organizator', sport: 'piłka nożna',
    field_id: null, field_name: 'Orlik testowy', lat, lng,
    title, description: null, event_date: dzien(1), event_time: '19:00:00', end_time: null,
    max_players: 14, min_players: null, visibility: 'public', status: 'active',
    created_at: new Date().toISOString(), cost_grosz: 0, team_mode: 'brak',
    track_payments: false, show_payment_status: false, track_results: false,
    confirmation_deadline_h: 24, teams_published: false, allow_guest_adds: false,
    join_code: 'ABC123', require_approval: false, max_goalkeepers: 2,
    goalkeeper_slots_reserved: true, goalkeepers_enabled: false,
    reserve_claim_minutes: 180, reserve_enabled: true, require_sms_confirmation: false,
    event_participants: [], fields: null,
  };
}

async function podstaw(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });
  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/rpc/mapa_skupiska')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.includes('/events')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': '0-1/2' },
        body: JSON.stringify([
          mecz('e1', 'Mecz w Szczecinie', 53.4285, 14.5528),
          mecz('e2', 'Mecz w Rzeszowie', 50.0413, 21.9990),
        ]),
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });
}

const widoczny = (page: Page, nazwa: string) =>
  page.getByRole('radio', { name: nazwa }).filter({ visible: true }).first();

test('przełączenie na mapę pokazuje oba mecze, nie punkt między nimi', async ({ page }) => {
  await podstaw(page);
  await page.goto('/mapa');
  await expect(page.getByText('Mecz w Szczecinie')).toBeVisible({ timeout: 15_000 });

  // Mapa jest tu zamontowana, ale schowana — to właśnie w tym stanie liczyło
  // się dotąd bezsensowne dopasowanie.
  await widoczny(page, 'Mapa').click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.waitForTimeout(1500);

  // Obie pinezki w kadrze. Przy dopasowaniu do zerowego kontenera mapa stała
  // gdzieś pod Łodzią z przybliżeniem rzędu 18 i nie było widać żadnej.
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);
  for (const pinezka of await page.locator('.leaflet-marker-icon').all()) {
    await expect(pinezka).toBeInViewport();
  }
});
