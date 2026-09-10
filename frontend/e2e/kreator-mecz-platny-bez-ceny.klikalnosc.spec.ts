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

/** Szkic w kształcie zapisywanym przez `lib/eventDraft.ts`, gotowy na kroku 3 —
 *  bo tam od 2026-09-10 (szybka ścieżka) siedzi „Mecz płatny", w zwiniętych
 *  „Ustawieniach zaawansowanych". Szkic jest jedyną drogą, żeby wejść wprost na
 *  krok 3: przejście przez krok 2 wymaga wskazania miejsca na mapie.
 *
 *  Lokalizacja jest WYPEŁNIONA i to nie jest ozdobnik: `handleSubmit` skleja
 *  błędy ze wszystkich kroków, a `stepForErrors()` bierze `Math.min`, czyli
 *  cofa na NAJWCZEŚNIEJSZY błędny krok. Przy pustym miejscu odmowa publikacji
 *  przenosiłaby na krok 2 („Gdzie") i testowany komunikat o koszcie nigdy nie
 *  wszedłby na ekran — mimo że reguła zadziałała. */
function szkicNaKroku3() {
  const jutro = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return {
    v: 1,
    ts: Date.now(),
    step: 3,
    values: {
      sport: 'piłka nożna',
      location: { venue: null, lat: 52.4064, lng: 16.9252, address: 'Testowa 1, Poznań' },
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

/** Otwiera zwinięty blok „Ustawienia zaawansowane" na kroku 3. */
async function otworzZaawansowane(page: Page) {
  const przycisk = page.getByRole('button', { name: /Ustawienia zaawansowane/i });
  await expect(przycisk).toBeVisible({ timeout: 15_000 });
  if ((await przycisk.getAttribute('aria-expanded')) !== 'true') await przycisk.click();
  await expect(przycisk).toHaveAttribute('aria-expanded', 'true');
}

/** Próba publikacji: pasek otwiera podgląd, dopiero przycisk w podglądzie
 *  woła `handleSubmit` — czyli jedyne miejsce, gdzie działa walidacja. */
async function sprobujOpublikowac(page: Page) {
  await page.getByRole('button', { name: /Sprawdź i opublikuj/i }).click();
  await page.getByRole('button', { name: /Opublikuj mecz/i }).click();
}

test('„Mecz płatny" bez ceny blokuje publikację i pokazuje błąd', async ({ page }) => {
  await zalogowanyZeSzkicem(page, szkicNaKroku3());
  await page.goto('/wydarzenia/nowe');
  await wznowSzkicJesliPyta(page);

  await otworzZaawansowane(page);

  const przelacznik = page.getByRole('switch', { name: 'Mecz płatny' });
  await expect(przelacznik).toBeVisible({ timeout: 15_000 });
  await przelacznik.click();
  await expect(przelacznik).toHaveAttribute('aria-checked', 'true');

  await sprobujOpublikowac(page);

  // Publikacja odmawia, a komunikat jest WIDOCZNY — mimo że pole siedzi
  // w sekcji, którą da się zwinąć.
  await expect(page.getByText('Podaj koszt od osoby')).toBeVisible();

  // Wpisanie ceny zdejmuje blokadę: ta sama próba publikacji nie wraca już
  // z komunikatem o koszcie.
  await page.getByPlaceholder('0 = za darmo').fill('10');
  await sprobujOpublikowac(page);
  await expect(page.getByText('Podaj koszt od osoby')).toHaveCount(0);
});

// SEDNO SZYBKIEJ ŚCIEŻKI: koszt zjechał do sekcji, którą da się ZWINĄĆ. Gdyby
// odmowa publikacji zostawiała ją zamkniętą, „Opublikuj mecz" wyglądałoby na
// przycisk, który nic nie robi — komunikat istniałby, ale w schowanym bloku.
test('zwinięte „Ustawienia zaawansowane" otwierają się same, gdy niosą błąd', async ({ page }) => {
  await zalogowanyZeSzkicem(page, szkicNaKroku3());
  await page.goto('/wydarzenia/nowe');
  await wznowSzkicJesliPyta(page);

  await otworzZaawansowane(page);
  await page.getByRole('switch', { name: 'Mecz płatny' }).click();

  // Zwijamy sekcję Z WŁĄCZONYM przełącznikiem i pustą ceną.
  const przycisk = page.getByRole('button', { name: /Ustawienia zaawansowane/i });
  await przycisk.click();
  await expect(przycisk).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('switch', { name: 'Mecz płatny' })).toHaveCount(0);

  await sprobujOpublikowac(page);

  await expect(przycisk).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Podaj koszt od osoby')).toBeVisible();
});
