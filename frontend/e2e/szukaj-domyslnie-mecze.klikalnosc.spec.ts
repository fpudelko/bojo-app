import { test, expect, type Page } from '@playwright/test';

/**
 * PIERWSZY EKRAN „SZUKAJ" TO OTWARTE MECZE W LIŚCIE.
 *
 * `/mapa` pokazywało domyślnie KATALOG BOISK na mapie. Dolna nawigacja
 * obchodziła to własnym `?gry=1`, ale każde inne wejście — kropka „Nowa gra
 * w promieniu 5 km", udostępniony link, wynik z wyszukiwarki — lądowało na
 * obiektach, czyli na odpowiedzi na inne pytanie niż „w co mogę dziś zagrać".
 * Zgłoszone wprost: „pierwsze co widoczne powinny być otwarte mecze w liście".
 *
 * Od 2026-08-26 jest odwrotnie: gry są domyślne, katalog wymaga `?gry=0`.
 * Test pilnuje OBU stron tej zamiany — sama zmiana domyślności, bez drugiej
 * połowy, wysłałaby „Mapę boisk" z nagłówka prosto do gier.
 */

const dzien = (o: number) => {
  const d = new Date(); d.setDate(d.getDate() + o);
  return d.toISOString().slice(0, 10);
};

function mecz(id: string, title: string, ile: number, max: number, dni: number) {
  return {
    id, organizer_id: 'org-1', organizer_name: 'Organizator', sport: 'piłka nożna',
    field_id: null, field_name: 'Orlik testowy', lat: 52.4, lng: 16.92,
    title, description: null, event_date: dzien(dni), event_time: '19:00:00', end_time: null,
    max_players: max, min_players: null, visibility: 'public', status: 'active',
    created_at: new Date().toISOString(), cost_grosz: 0, team_mode: 'brak',
    track_payments: false, show_payment_status: false, track_results: false,
    confirmation_deadline_h: 24, teams_published: false, allow_guest_adds: false,
    join_code: 'ABC123', require_approval: false, max_goalkeepers: 2,
    goalkeeper_slots_reserved: true, goalkeepers_enabled: false,
    reserve_claim_minutes: 180, reserve_enabled: true, require_sms_confirmation: false,
    event_participants: Array.from({ length: ile }, (_, i) => ({
      id: `${id}-${i}`, is_reserve: false, pending_approval: false,
    })),
    fields: null,
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
          // JUTRO I POJUTRZE, nie „dziś" — mecz z dzisiejszą datą i godziną
          // 19:00 przestaje być otwarty (`isEventJoinable`) po 19:00, więc ten
          // test padał wieczorem i przechodził rano. Data nie ma tu nic do
          // rzeczy: sprawdzamy, że gołe /mapa pokazuje mecze W LIŚCIE.
          mecz('e1', 'Wolne miejsca', 8, 14, 1),
          mecz('e2', 'Komplet pojutrze', 10, 10, 2),
        ]),
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });
}

/** Przełączniki są w DOM dwa razy (nakładka mobilna i pasek desktopu) —
 *  trafiamy w widoczny, pułapka opisana w AGENTS.md. */
const widoczny = (page: Page, nazwa: string) =>
  page.getByRole('radio', { name: nazwa }).filter({ visible: true }).first();

test('gołe /mapa pokazuje otwarte mecze w liście, nie katalog boisk', async ({ page }) => {
  await podstaw(page);
  await page.goto('/mapa');

  // Mecze jako karty listy, z liczbą graczy — nie pinezki na oddalonej mapie,
  // które przy widoku całego kraju i tak zlewają się w skupiska.
  await expect(page.getByText('Wolne miejsca')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('8/14 graczy')).toBeVisible();
  await expect(page.getByText('Komplet pojutrze')).toBeVisible();

  await expect(widoczny(page, 'Gry')).toHaveAttribute('aria-checked', 'true');
  await expect(widoczny(page, 'Lista')).toHaveAttribute('aria-checked', 'true');
});

test('katalog obiektów wymaga jawnego ?gry=0 i wtedy działa', async ({ page }) => {
  await podstaw(page);
  await page.goto('/mapa?gry=0');

  await expect(widoczny(page, 'Obiekty')).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
  // Żaden mecz nie ma prawa się tu pokazać.
  await expect(page.getByText('Wolne miejsca')).toHaveCount(0);
});
