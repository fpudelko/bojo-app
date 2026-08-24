import { test, expect, type Page } from '@playwright/test';

/**
 * „DALEJ" NIE MA PRAWA MILCZEĆ.
 *
 * Zgłoszone wprost: „jak nie włączę toggle z bramkarzami, to wewnątrz jest
 * ukryty błąd" — przycisk „Dalej" na kroku 1 przestawał reagować i nic tego
 * nie tłumaczyło.
 *
 * Mechanizm: szkic zapisany ZANIM przełącznik „Bramkarze osobno" stał się
 * widoczny niesie `goalkeepersEnabled: null` („jeszcze nie zdecydowano").
 * `validateGoalkeepers()` blokuje na tym krok 1, a komunikat renderuje się
 * WEWNĄTRZ `UstawieniaBramkarzy` — które przy wyłączonym przełączniku w ogóle
 * nie są zamontowane. Błąd istniał, tylko nie miał gdzie się pokazać.
 *
 * Dwie warstwy naprawy, dwa testy:
 *   1. szkic nie przywraca już „jeszcze nie zdecydowano" (`?? false`),
 *   2. gdyby jakikolwiek błąd trafił do zwiniętej sekcji, wychodzi do jej
 *      nagłówka — tego pilnuje `opcjaMeczu.test.tsx`, bo to reguła samego
 *      komponentu, nie tej jednej strony.
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
    // Stare konto: modal powitalny dla świeżych kont nie ma tu nic do roboty.
    created_at: '2025-01-01T10:00:00.000Z',
    updated_at: '2025-01-01T10:00:00.000Z',
  },
};

/** Szkic w kształcie zapisywanym przez `lib/eventDraft.ts`, z bramkarzami
 *  w stanie sprzed przełącznika. */
function szkicZeStarymiBramkarzami() {
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
      goalkeepersEnabled: null,   // ← sedno sprawy
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

/** Kreator potrafi zapytać, czy wrócić do szkicu — jeśli pyta, wracamy. */
async function wznowSzkicJesliPyta(page: Page) {
  const wznow = page.getByRole('button', { name: /Wróć do szkicu|Kontynuuj|Wznów/i }).first();
  if (await wznow.isVisible().catch(() => false)) await wznow.click();
}

test('szkic sprzed przełącznika bramkarzy nie blokuje „Dalej"', async ({ page }) => {
  await zalogowanyZeSzkicem(page, szkicZeStarymiBramkarzami());
  await page.goto('/wydarzenia/nowe');
  await wznowSzkicJesliPyta(page);

  const dalej = page.getByRole('button', { name: /Dalej/i }).first();
  await expect(dalej).toBeVisible({ timeout: 15_000 });
  await dalej.click();

  // Krok 1 puszcza dalej: jesteśmy na „Lokalizacji", nie stoimy w miejscu.
  await expect(page.getByText('Lokalizacja')).toBeVisible();
});
