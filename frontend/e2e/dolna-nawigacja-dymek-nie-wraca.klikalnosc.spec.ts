import { test, expect, type Page } from '@playwright/test';

/**
 * DYMEK POD DOLNĄ NAWIGACJĄ NIE WRACA PO KAŻDYM WEJŚCIU NA UKRYTY EKRAN.
 *
 * Zgłoszone wprost z sesji QA: dymek „Przytrzymaj «Grupy»" wyglądał, jakby
 * wisiał na każdym ekranie. Powód: ekrany z `<HideBottomNav/>` (m.in.
 * kreator meczu) kiedyś ODMONTOWYWAŁY `BottomNav`, więc `poprzednieAktywne`
 * (ref pilnujący przejścia false→true) zerował się przy KAŻDYM powrocie na
 * ekran z paskiem — dymek pokazywał się od nowa i licznik pokazań w
 * `localStorage` rósł przy każdym wyjściu z kreatora, nie raz na aktywację.
 * Naprawa: `BottomNav` zostaje zamontowany, chowa się przez CSS (`hidden`).
 *
 * Test dowodzi tego licznikiem: po kilku wejściach w kreator i powrotach,
 * licznik pokazań ma zostać na 1 — nie rosnąć z każdym cyklem.
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
  await page.addInitScript(({ sesja }) => {
    try {
      localStorage.setItem('bojo_cookie_consent_v1', '1');
      localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(sesja));
    } catch { /* tryb prywatny */ }
  }, { sesja: SESJA });

  await page.route('**/auth/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESJA) }));

  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    // `getMyGroups()`: dwa zapytania, `group_members` po id-ki, potem
    // `groups` po dane — jedna ekipa wystarcza, żeby `maGrupy` było `true`
    // i dymek „Przytrzymaj «Grupy»" miał się o co zapalić.
    if (url.includes('/group_members')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': '0-0/1' },
        body: JSON.stringify([{ group_id: 'g1' }]),
      });
    }
    if (url.includes('/groups')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': '0-0/1' },
        body: JSON.stringify([{
          id: 'g1', name: 'Testowa ekipa', created_at: new Date().toISOString(),
          group_members: [{ id: 'gm1' }],
        }]),
      });
    }
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

const kluczDymka = 'bojo:dymek-pokazania:przytrzymaj-grupy';

test('dymek „Przytrzymaj «Grupy»" nie odlicza od nowa po każdym wyjściu z kreatora', async ({ page }, testInfo) => {
  // Dolny pasek nawigacji istnieje wyłącznie na telefonie (`md:hidden`) —
  // na desktopie nie ma czego testować.
  test.skip(testInfo.project.name !== 'telefon', 'Dolna nawigacja jest tylko na telefonie');
  await zalogowany(page);
  await page.goto('/wydarzenia');

  const nowyMecz = page.getByRole('link', { name: 'Stwórz nowy mecz' }).filter({ visible: true }).first();
  await expect(nowyMecz).toBeVisible({ timeout: 15_000 });

  // Pierwsza aktywacja dymka dzieje się od razu po wejściu — daj Reactowi
  // chwilę na efekt, zanim zaczniemy cykle wejść/wyjść.
  await page.waitForFunction(
    (klucz) => window.localStorage.getItem(klucz) !== null,
    kluczDymka,
    { timeout: 10_000 },
  );
  await expect.poll(() => page.evaluate((k) => window.localStorage.getItem(k), kluczDymka)).toBe('1');

  for (let i = 0; i < 3; i++) {
    await nowyMecz.click();
    await expect(page).toHaveURL(/\/wydarzenia\/nowe/);
    await page.goBack();
    await expect(page).toHaveURL(/\/wydarzenia$/);
  }

  // Bez naprawy każdy powrót z kreatora podbijałby licznik (2, 3, 4) —
  // z naprawą zostaje na 1, bo `BottomNav` ani razu się nie odmontował.
  const ile = await page.evaluate((k) => window.localStorage.getItem(k), kluczDymka);
  expect(ile).toBe('1');
});
