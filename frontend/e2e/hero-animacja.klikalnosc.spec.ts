import { test, expect, type Page } from '@playwright/test';
import { datyHero } from '../src/lib/datyHero';
import { LANDING_ANIMACJA, LANDING_HERO } from '../src/components/home/landing/content';

/**
 * ANIMACJA NA PIERWSZYM EKRANIE STRONY GŁÓWNEJ (hero).
 *
 * Nagłówek, opis i przyciski są STAŁE, a pod telefonem stoi pięć pasków
 * rozdziałów, które trzeba dać się kliknąć. Test pilnuje rzeczy, których nie
 * widzi ani `tsc`, ani Vitest, a które psuły się przy przenoszeniu makiety:
 *  - paski faktycznie przełączają rozdział (a nie tylko wyglądają),
 *  - nic nie jest ucięte ani zasłonięte,
 *  - daty w telefonie liczą się od dziś (makieta miała „01.10.2026” wpisane
 *    na sztywno),
 *  - hydracja nie rzuca błędu (React #418/#423 renderuje wtedy CAŁĄ stronę od nowa),
 *  - dawne przyciski „Pauza” i „Od początku” nie wróciły.
 */

const R = LANDING_ANIMACJA.rozdzialy;

async function otworz(page: Page, ograniczonyRuch = false) {
  // `test.use({ reducedMotion })` nie ustawia emulacji; działa tylko to wywołanie.
  if (ograniczonyRuch) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' }));
  await page.goto('/');
  await expect(page.locator('.ha[data-gotowy="1"]')).toBeAttached();
}

const paski = (page: Page) => page.getByRole('group', { name: LANDING_ANIMACJA.paskiGrupa }).getByRole('button');

test.describe('hero: stałe elementy', () => {
  test('nagłówek, przyciski i rząd zaufania są na miejscu, bez Pauzy i „Od początku”', async ({ page }) => {
    await otworz(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Zorganizuj mecz');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('w dwie minuty');
    await expect(page.getByRole('link', { name: 'Zorganizuj mecz' }).first()).toHaveAttribute('href', '/wydarzenia/nowe');
    await expect(page.getByRole('link', { name: /albo przejrzyj otwarte gry/ })).toHaveAttribute('href', '/wydarzenia');
    for (const t of LANDING_HERO.trust) await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /pauza|od początku|wznów/i })).toHaveCount(0);
  });

  test('nagłówek ma dokładnie dwie linie', async ({ page }) => {
    await otworz(page);
    const linie = await page.locator('h1').evaluate((h) => Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)));
    expect(linie).toBe(2);
  });

  test('hydracja bez błędów (React #418/#423/#425)', async ({ page }) => {
    const bledy: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text()); });
    page.on('pageerror', (e) => bledy.push(String(e)));
    await otworz(page);
    await page.waitForTimeout(1500);
    const hydracja = bledy.filter((b) => /hydrat|#418|#423|#425|did not match/i.test(b));
    expect(hydracja).toEqual([]);
  });
});

test.describe('hero: paski rozdziałów', () => {
  test('jest ich pięć i każdy ma czytelną nazwę', async ({ page }) => {
    await otworz(page);
    await expect(paski(page)).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await expect(paski(page).nth(i)).toHaveAccessibleName(`${LANDING_ANIMACJA.paskiPrzycisk} ${R[i].nazwa}`);
    }
  });

  test('paski da się kliknąć: rozdział się przełącza, podpis pasuje, nic nie jest ucięte', async ({ page }) => {
    await otworz(page);
    await page.locator('.ha-slot').scrollIntoViewIfNeeded();
    const podpis = page.locator('div.truncate.text-center');
    for (const i of [2, 4, 1, 0, 3]) {
      await paski(page).nth(i).click();
      await expect(paski(page).nth(i)).toHaveAttribute('aria-current', 'step');
      // Podpis pierwszej klatki każdego rozdziału to jeden ze zdefiniowanych.
      await expect(podpis).toHaveText(new RegExp(Object.values(LANDING_ANIMACJA.podpisy).map((p) => p.replace(/[?.]/g, '\\$&')).join('|')));
      const uciety = await podpis.evaluate((e) => e.scrollWidth > e.clientWidth);
      expect(uciety, `podpis rozdziału ${i + 1} ucięty`).toBe(false);
    }
  });

  test('pasek jest dość duży do trafienia palcem (min. 44 x 24 px)', async ({ page }) => {
    await otworz(page);
    const box = await paski(page).first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  });
});

test.describe('hero: plakietka nad nagłówkiem', () => {
  test('na komputerze zmienia się z rozdziałem, na telefonie zostaje stały napis', async ({ page, isMobile }) => {
    await otworz(page);
    await page.locator('.ha-slot').scrollIntoViewIfNeeded();
    await paski(page).nth(3).click();
    const stala = page.getByText(LANDING_HERO.badge, { exact: true });
    const nazwa = page.getByText(R[3].nazwa, { exact: true }).first();
    if (isMobile) {
      await expect(stala.first()).toBeVisible();
    } else {
      await expect(nazwa).toBeVisible();
      await expect(stala.first()).toBeHidden();
    }
  });
});

test.describe('hero: ograniczony ruch', () => {
  test('stały napis w plakietce, statyczna klatka i paski nadal działają', async ({ page }) => {
    await otworz(page, true);
    await expect(page.getByText(LANDING_HERO.badge, { exact: true }).first()).toBeVisible();
    await page.locator('.ha-slot').scrollIntoViewIfNeeded();
    await paski(page).nth(0).click();
    await expect(paski(page).nth(0)).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('div.truncate.text-center')).toHaveText(R[0].spoczynek);
  });

  test('daty w kreatorze liczą się od dziś, nie są wpisane na sztywno', async ({ page }) => {
    await otworz(page, true);
    await page.locator('.ha-slot').scrollIntoViewIfNeeded();
    await paski(page).nth(0).click();
    const d = datyHero();
    await expect(page.locator('.ha #w1-dh')).toHaveText(d.celOpis);
    await expect(page.locator('.ha #w1-date .v')).toHaveText(d.cel);
    // Data meczu jest w tekście podsumowania przed publikacją.
    await expect(page.locator('.ha #s-w3')).toContainText(`${d.celDluga} · 18:00–19:30`);
  });

  test('profil organizatora w telefonie ma inicjał M, a nie J', async ({ page }) => {
    await otworz(page, true);
    await page.locator('.ha-slot').scrollIntoViewIfNeeded();
    await paski(page).nth(0).click();
    const inicjaly = await page.locator('.ha .ab .av').allTextContents();
    expect(inicjaly.length).toBeGreaterThan(0);
    expect(new Set(inicjaly)).toEqual(new Set(['M']));
  });
});
