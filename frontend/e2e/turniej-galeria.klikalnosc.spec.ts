import { test, expect, type Page } from '@playwright/test';

/**
 * GALERIA I SPONSORZY NA ZAKŁADCE INFO TURNIEJU (migracja `159`).
 *
 * Podgląd zdjęcia to pełnoekranowe okno — dokładnie ta klasa elementu, która
 * już raz wyłożyła produkcję, gdy dolna nawigacja wjechała NAD modale
 * (`lib/warstwy.ts`). Tu sprawdzamy, że miniaturę da się kliknąć, a okno
 * przewija się strzałką, zamyka Escape'em i nie jest niczym przykryte.
 *
 * Drugie: link sponsora wpisuje organizator, a widzi go każdy odwiedzający.
 * `javascript:` z bazy NIE może trafić do `href` — `bezpiecznyLinkSponsora()`
 * ma go po cichu zgubić, a sponsor zostać jako sama nazwa.
 *
 * Atrapa siedzi WYŁĄCZNIE w sieci (`page.route`), ścieżka kodu w aplikacji
 * jest prawdziwa — ten sam wzorzec co w `mecz-blad-wczytania.klikalnosc.spec.ts`.
 */

const ID = '22222222-2222-4222-8222-222222222222';

const TURNIEJ = {
  id: ID,
  organizator_id: '33333333-3333-4333-8333-333333333333',
  nazwa: 'Turniej z galerią',
  sport: 'piłka nożna',
  format: 'liga',
  status: 'zapisy',
  widocznosc: 'publiczny',
  data_startu: '2030-06-01',
  godzina_startu: '10:00',
  max_druzyn: 8,
  min_zawodnikow: 5,
  max_zawodnikow: 10,
  awansuje_z_grupy: 2,
  mecz_o_3_miejsce: false,
  czas_meczu_min: 15,
  przerwa_min: 5,
  punkty_za_wygrana: 3,
  punkty_za_remis: 1,
  karne_przy_remisie: true,
  wpisowe_grosz: 0,
  wymaga_akceptacji: false,
  created_at: '2030-01-01T00:00:00Z',
};

const zdjecie = (n: number) => ({
  id: `44444444-4444-4444-8444-00000000000${n}`,
  turniej_id: ID,
  sciezka: `turnieje/${ID}/galeria/${n}.png`,
  kolejnosc: n,
  dodane_przez: null,
  created_at: '2030-01-01T00:00:00Z',
});

const SPONSORZY = [
  {
    id: '55555555-5555-4555-8555-000000000001', turniej_id: ID, nazwa: 'Piekarnia Rogal',
    sciezka_logo: null, link: 'https://piekarnia.example', kolejnosc: 0, created_at: '2030-01-01T00:00:00Z',
  },
  {
    id: '55555555-5555-4555-8555-000000000002', turniej_id: ID, nazwa: 'Podejrzany Sponsor',
    sciezka_logo: null, link: 'javascript:alert(1)', kolejnosc: 1, created_at: '2030-01-02T00:00:00Z',
  },
];

// Najmniejszy poprawny PNG (1×1) — obrazki z bucketu nie mają skąd przyjść.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

async function atrapaTurnieju(page: Page) {
  // Odczyt zdjęć/logotypów idzie wprost pod NEXT_PUBLIC_R2_PUBLIC_URL
  // (Cloudflare R2, migracja `160`) — build testowy ustawia tam
  // `placeholder.r2.dev`, patrz playwright.config.ts.
  await page.route('**/placeholder.r2.dev/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));

  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    const obiekt = (route.request().headers()['accept'] ?? '').includes('pgrst.object');
    const lista = (wiersze: unknown[]) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(wiersze),
    });

    if (url.includes('/rest/v1/turnieje?')) {
      return obiekt
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TURNIEJ) })
        : lista([TURNIEJ]);
    }
    if (url.includes('/rest/v1/turniej_zdjecia?')) return lista([zdjecie(1), zdjecie(2), zdjecie(3)]);
    if (url.includes('/rest/v1/turniej_sponsorzy?')) return lista(SPONSORZY);
    if (obiekt) {
      return route.fulfill({
        status: 406, contentType: 'application/json',
        body: '{"code":"PGRST116","details":"The result contains 0 rows","message":"JSON object requested, multiple (or no) rows returned"}',
      });
    }
    return lista([]);
  });
}

test.describe('turniej — galeria i sponsorzy na zakładce Info', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
    });
    await atrapaTurnieju(page);
  });

  test('miniatura otwiera podgląd, strzałka przewija, Escape zamyka', async ({ page }) => {
    await page.goto(`/turnieje/${ID}?tab=info`);

    await expect(page.getByRole('heading', { name: 'Galeria' })).toBeVisible();
    const miniatury = page.getByRole('button', { name: /Otwórz zdjęcie/ });
    await expect(miniatury).toHaveCount(3);

    // Klik REALNY — gdyby cokolwiek przykrywało miniaturę albo podgląd,
    // Playwright zgłosi „intercepts pointer events".
    await miniatury.first().click();
    const podglad = page.getByRole('dialog', { name: 'Zdjęcie 1 z 3' });
    await expect(podglad).toBeVisible();
    await expect(podglad.getByRole('button', { name: 'Poprzednie zdjęcie' })).toHaveCount(0);

    await podglad.getByRole('button', { name: 'Następne zdjęcie' }).click();
    await expect(page.getByRole('dialog', { name: 'Zdjęcie 2 z 3' })).toBeVisible();

    await page.keyboard.press('ArrowRight');
    const ostatnie = page.getByRole('dialog', { name: 'Zdjęcie 3 z 3' });
    await expect(ostatnie).toBeVisible();
    await expect(ostatnie.getByRole('button', { name: 'Następne zdjęcie' })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('przycisk „Zamknij” w podglądzie da się kliknąć', async ({ page }) => {
    await page.goto(`/turnieje/${ID}?tab=info`);
    await page.getByRole('button', { name: 'Otwórz zdjęcie 2' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Zamknij' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('link sponsora prowadzi na stronę, a javascript: z bazy nie trafia do href', async ({ page }) => {
    await page.goto(`/turnieje/${ID}?tab=info`);

    await expect(page.getByRole('heading', { name: 'Sponsorzy' })).toBeVisible();
    const dobry = page.getByRole('link', { name: 'Piekarnia Rogal' });
    await expect(dobry).toHaveAttribute('href', 'https://piekarnia.example/');
    await expect(dobry).toHaveAttribute('rel', /sponsored/);

    // Sponsor zostaje widoczny — znika wyłącznie niebezpieczny link.
    await expect(page.getByText('Podejrzany Sponsor')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Podejrzany Sponsor' })).toHaveCount(0);
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  });

  test('gość bez uprawnień nie widzi pustej galerii', async ({ page }) => {
    await page.unroute('**/rest/v1/**');
    await page.route('**/rest/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('/rest/v1/turnieje?')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TURNIEJ) });
      }
      const obiekt = (route.request().headers()['accept'] ?? '').includes('pgrst.object');
      if (obiekt) {
        return route.fulfill({
          status: 406, contentType: 'application/json',
          body: '{"code":"PGRST116","details":"The result contains 0 rows","message":"JSON object requested, multiple (or no) rows returned"}',
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto(`/turnieje/${ID}?tab=info`);
    await expect(page.getByText('Turniej z galerią').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Galeria' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sponsorzy' })).toHaveCount(0);
  });
});
