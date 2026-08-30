import { test, expect, type Page } from '@playwright/test';

/**
 * „MECZ PŁATNY" BEZ CENY NIE PRZECHODZI „DALEJ" PO CICHU.
 *
 * Zgłoszone wprost z sesji QA: włączenie przełącznika „Mecz płatny" i
 * zostawienie pustego pola ceny puszczało krok 1 dalej bez ostrzeżenia —
 * mecz zapisywał się jako darmowy, mimo że organizator zaznaczył co innego.
 * `platny` jest niezależnym przełącznikiem (`useState`), nie pochodną
 * `costPln > 0` — `validatePayments()` do 2026-08-28 sprawdzała tylko samą
 * kwotę i nie wiedziała o tym stanie.
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

/** Szkic w kształcie zapisywanym przez `lib/eventDraft.ts`, gotowy na kroku 1 —
 *  wszystko poza płatnościami wypełnione tak, żeby walidacja bramkarzy/rezerwy
 *  nie przeszkadzała w dotarciu do testowanego pola. */
function szkicNaKroku1() {
  const jutro = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return {
    v: 1,
    ts: Date.now(),
    step: 1,
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
      goalkeepersEnabled: false,
      slotyZarezerwowane: true,
      reserveClaimMinutes: 180,
      reserveEnabled: false,
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
      trackPayments: false,
      showPaymentStatus: false,
      allowGuestAdds: false,
      recurringEnabled: false,
      recurringNotifyDaysBefore: 3,
    },
  };
}

async function zalogowanyZeSzkicem(page: Page, szkic: unknown | null) {
  await page.addInitScript(({ sesja, draft }) => {
    try {
      localStorage.setItem('bojo_cookie_consent_v1', '1');
      localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(sesja));
      if (draft) localStorage.setItem('bojo_event_draft_v1', JSON.stringify(draft));
    } catch { /* tryb prywatny */ }
  }, { sesja: SESJA, draft: szkic });

  await page.route('**/auth/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESJA) }));
  await page.route('**/rest/v1/**', (route) => {
    if ((route.request().headers()['accept'] ?? '').includes('pgrst.object')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: SESJA.user.id, display_name: 'Jan Testowy' }),
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });
}

async function wznowSzkicJesliPyta(page: Page) {
  const wznow = page.getByRole('button', { name: /Wróć do szkicu|Kontynuuj|Wznów/i }).first();
  if (await wznow.isVisible().catch(() => false)) await wznow.click();
}

test('„Mecz płatny" bez ceny blokuje „Dalej" i pokazuje błąd', async ({ page }) => {
  await zalogowanyZeSzkicem(page, szkicNaKroku1());
  await page.goto('/wydarzenia/nowe');
  await wznowSzkicJesliPyta(page);

  const przelacznik = page.getByRole('switch', { name: 'Mecz płatny' });
  await expect(przelacznik).toBeVisible({ timeout: 15_000 });
  await przelacznik.click();
  await expect(przelacznik).toHaveAttribute('aria-checked', 'true');

  const dalej = page.getByRole('button', { name: /Dalej/i }).first();
  await dalej.click();

  // Krok 1 NIE puszcza dalej — „Lokalizacja" (krok 2) się nie pojawia,
  // a błąd przy cenie jest widoczny.
  await expect(page.getByText('Podaj koszt od osoby')).toBeVisible();
  await expect(page.getByText('Lokalizacja')).not.toBeVisible();

  // Wpisanie ceny odblokowuje przejście dalej.
  await page.getByPlaceholder('0 = za darmo').fill('10');
  await dalej.click();
  await expect(page.getByText('Lokalizacja')).toBeVisible();
});
