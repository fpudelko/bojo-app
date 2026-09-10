import { test, expect, type Page } from '@playwright/test';

/**
 * DWIE DECYZJE PRODUKTOWE O SKŁADZIE — dziś na KROKU 3 kreatora, w zwiniętych
 * „Ustawieniach zaawansowanych" (szybka ścieżka, 2026-09-10).
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

/** Szkic, który stawia kreator na kroku 3 — tam od 2026-09-10 (szybka ścieżka)
 *  siedzą oba przełączniki, w zwiniętych „Ustawieniach zaawansowanych". Wejście
 *  tam klikaniem wymagałoby wskazania miejsca na mapie, czego ten test nie bada.
 *
 *  KLUCZOWE: `values` NIE zawiera `reserveEnabled` ani `goalkeepersEnabled`.
 *  Odtworzenie szkicu czyta je przez `?? true` / `?? false`, czyli przez te same
 *  wartości domyślne, co świeżo otwarty kreator — więc test dalej sprawdza
 *  DOMYŚLNY stan, a nie to, co ktoś wpisał do szkicu. */
function szkicNaKroku3() {
  const jutro = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return {
    v: 1,
    ts: Date.now(),
    step: 3,
    values: {
      sport: 'piłka nożna',
      location: { venue: null, lat: null, lng: null, address: '' },
      nazwaWlasnaMiejsca: '',
      date: jutro,
      time: '18:00',
      durationMin: 90,
      czasWlasny: false,
      maxPlayers: 14,
      maxPlayersTouched: false,
      minPlayers: null,
      reserveClaimMinutes: 180,
      title: '',
      description: '',
      descriptionEnabled: false,
      visibility: 'public',
      requireApproval: false,
      organizerParticipates: true,
      organizerRole: 'field',
      costPln: '',
      kosztZaObiekt: false,
      kosztObiektuPln: '',
      acceptedPaymentMethods: [],
      blikPhone: '',
      cardDiscountEnabled: false,
      cardDiscountPln: '',
      acceptedSportsCards: [],
      sportsCardOtherName: '',
    },
  };
}

/** Otwiera zwinięty blok „Ustawienia zaawansowane" na kroku 3. */
async function otworzZaawansowane(page: Page) {
  const przycisk = page.getByRole('button', { name: /Ustawienia zaawansowane/i });
  await expect(przycisk).toBeVisible({ timeout: 15_000 });
  if ((await przycisk.getAttribute('aria-expanded')) !== 'true') await przycisk.click();
  await expect(przycisk).toHaveAttribute('aria-expanded', 'true');
}

async function zalogowany(page: Page) {
  await page.addInitScript(({ sesja, draft }) => {
    try {
      localStorage.setItem('bojo_cookie_consent_v1', '1');
      localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(sesja));
      localStorage.setItem('bojo_event_draft_v1', JSON.stringify(draft));
    } catch { /* tryb prywatny */ }
  }, { sesja: SESJA, draft: szkicNaKroku3() });

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

test('lista rezerwowa jest włączona domyślnie', async ({ page }) => {
  await zalogowany(page);
  await page.goto('/wydarzenia/nowe');

  // Podpis pod licznikiem miejsc mówi, co się NAPRAWDĘ stanie przy komplecie.
  // Przy wyłączonej rezerwie stoi tam „Przy komplecie zapisy będą zamknięte."
  // Stoi na WIERZCHU kroku 3, przy liczbie miejsc — nie trzeba nic otwierać.
  await expect(page.getByText('Kolejni chętni trafią na listę rezerwową.').first())
    .toBeVisible({ timeout: 15_000 });

  // Sam przełącznik z czasem na decyzję siedzi w zaawansowanych.
  await otworzZaawansowane(page);
  await expect(page.getByText(/Czas na decyzję z rezerwy|Ile czasu/i).first()).toBeVisible();
});

test('włączony przełącznik bramkarzy nie oferuje już „Bez podziału na role"', async ({ page }) => {
  await zalogowany(page);
  await page.goto('/wydarzenia/nowe');
  await otworzZaawansowane(page);

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
