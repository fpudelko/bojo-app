import { test, expect, type Page } from '@playwright/test';

/**
 * DWA BŁĘDY Z SESJI QA, oba w widoku „Lista" po `/mapa` → „Obiekty" →
 * „Lista" — czyli mapa NIGDY nie dostaje realnego rozmiaru (montuje się od
 * razu z `display:none`, bo `widok` startuje jako 'lista' w trybie gier
 * i przełącznik „Obiekty" tego nie zmienia).
 *
 *  1. „Licznik na liście obiektów pokazuje »0 boisk«, a lista pełna" —
 *     nagłówek nad listą i CTA arkusza filtrów liczyły z `wKadrze` (suma
 *     skupisk policzona z KADRU MAPY, czyli — przy nigdy niepokazanej mapie —
 *     z pustej `skupiska`), a lista renderowała się z zupełnie innego
 *     źródła (`listaStartowa`/`listaWokolMiejscowosci`). Naprawa: licznik
 *     nad listą i podgląd w arkuszu liczą dziś z `fields.length` — z tego
 *     samego źródła, co karty pod spodem.
 *
 *  2. „Po zastosowaniu filtrów z wybraną miejscowością lista jest (pozornie)
 *     pusta, dopóki nie przełączysz Mapa→Lista". ZWERYFIKOWANE: mapa ukryta
 *     (`display:none`, kontener 0×0) NIE aktualizuje `zoom`/kadru w ogóle —
 *     Leaflet nie odpala `moveend`/`zoomend` na niezaładowanym kontenerze,
 *     więc `KadrObserwator` faktycznie nigdy się tu nie odzywa i teoria
 *     o „zatrutym kadrze" nie potwierdziła się w praktyce (sprawdzone
 *     zrzutami żądań sieciowych). Prawdziwa przyczyna: `listaWokolMiejscowosci`
 *     dociąga się WŁASNYM, poprawnym zapytaniem i samo się aktualizuje bez
 *     dotykania widoku — ale W TRAKCIE tego zapytania `fields` spada na
 *     `listaStartowa` (STARĄ okolicę), która po przefiltrowaniu do nowego
 *     sportu/typu często wychodzi na zero — i wtedy renderował się pusty
 *     stan z przyciskami „Pokaż blisko mnie"/„Przybliż", zupełnie nie na
 *     temat tuż po wybraniu miejscowości. Wyglądało na trwałą usterkę,
 *     a było tylko chwilą bez informacji zwrotnej — naprawiono osobnym
 *     stanem ładowania („Szukam w okolicy: …") w miejscu tego pustego stanu.
 *
 * `KadrObserwator` dostał przy okazji osłonę na kontener mniejszy niż 80×80
 * (ten sam wzorzec co `GamesMarkersLayer.dopasujKadr`) — nie jako mechanizm
 * naprawiający błąd 2 (nie jest, patrz wyżej), tylko jako defensywne
 * dociągnięcie do reszty kodu: zgłoszenie zdegenerowanego kadru nigdy nie
 * jest tym, czego chce wywołujący.
 */

const BOISKA_KRAKOW = Array.from({ length: 6 }, (_, i) => ({
  id: `k${i}`, name: `Orlik Kraków ${i}`, address: 'Kraków, Nowa Huta',
  lat: 50.0614 + i * 0.001, lng: 19.9366 + i * 0.001,
  sport: i % 2 === 0 ? ['koszykówka'] : ['piłka nożna'],
  venue_type: 'orlik', surface: i % 2 === 0 ? 'hardcourt' : 'artificial',
}));

/** Lista startowa (okolica Poznania) — GEOGRAFICZNIE UCZCIWA, celowo bez
 *  koszykówki. Gdyby atrapa oddawała to samo niezależnie od zapytanego
 *  miasta (jak w pierwszej wersji tego testu), test 2 przechodziłby również
 *  z błędem: `listaStartowa` „przypadkiem" pasowałaby do filtra Koszykówka
 *  i maskowała dokładnie to okno bez informacji zwrotnej, które ten test
 *  ma sprawdzić. */
const BOISKA_POZNAN = Array.from({ length: 6 }, (_, i) => ({
  id: `p${i}`, name: `Orlik Poznań ${i}`, address: 'Poznań, Rataje',
  lat: 52.4064 + i * 0.001, lng: 16.9252 + i * 0.001,
  sport: ['piłka nożna'], venue_type: 'orlik', surface: 'artificial',
}));

const KRAKOW = { nazwa: 'Kraków', kontekst: 'małopolskie', lat: 50.0614, lng: 19.9366 };

async function podstaw(page: Page, opoznienieKrakowa?: Promise<void>) {
  await page.addInitScript(() => {
    try { localStorage.setItem('bojo_cookie_consent_v1', '1'); } catch { /* tryb prywatny */ }
  });

  await page.route('**/api/geocode**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('miejscowosc')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([KRAKOW]) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/rpc/mapa_skupiska')) {
      // Zwraca coś niezerowego — gdyby licznik nad listą po staremu liczył
      // ze skupisk (wKadrze), test i tak by przeszedł przez przypadek, gdyby
      // ta liczba akurat zgadzała się z listą. Zwracamy inną wartość niż
      // liczba boisk, żeby regresja była WIDOCZNA, nie zamaskowana zbiegiem.
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ lat: 50.0, lng: 20.0, ile: 999 }]),
      });
    }
    if (url.pathname.includes('/fields')) {
      // Osłona na wypadek zdegenerowanego (bliskiego zeru) kadru — w praktyce
      // nie widzieliśmy go tu wywołanego (mapa ukryta nigdy nie zgłasza kadru
      // wcale, patrz nagłówek pliku), ale gdyby kiedyś zaczęła, ma dostać
      // PUSTKĘ, nie te same dane co prawdziwe zapytanie (`kadrWokol`,
      // szerokość rzędu 0.1–1°) — inaczej ten test przechodziłby również
      // z regresją.
      const lat = url.searchParams.getAll('lat');
      const gte = lat.find((p) => p.startsWith('gte.'));
      const lte = lat.find((p) => p.startsWith('lte.'));
      if (gte && lte) {
        const szerokosc = Number(lte.slice(4)) - Number(gte.slice(4));
        if (!(szerokosc > 0.01)) {
          return route.fulfill({
            status: 200, contentType: 'application/json',
            headers: { 'content-range': '0-0/0' }, body: '[]',
          });
        }
        // Kraków leży ~50°N, Poznań ~52°N — próg 51° dzieli je jednoznacznie.
        if (Number(gte.slice(4)) < 51) {
          if (opoznienieKrakowa) await opoznienieKrakowa;
          return route.fulfill({
            status: 200, contentType: 'application/json',
            headers: { 'content-range': `0-${BOISKA_KRAKOW.length - 1}/${BOISKA_KRAKOW.length}` },
            body: JSON.stringify(BOISKA_KRAKOW),
          });
        }
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': `0-${BOISKA_POZNAN.length - 1}/${BOISKA_POZNAN.length}` },
        body: JSON.stringify(BOISKA_POZNAN),
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/0' }, body: '[]',
    });
  });
}

test('licznik nad listą pokazuje realną liczbę, nie „0 boisk" znad kadru mapy', async ({ page }) => {
  await podstaw(page);
  // Bare /mapa: tryb Gry (domyślny), widok startuje jako „Lista".
  await page.goto('/mapa');
  await page.getByRole('radio', { name: 'Obiekty' }).filter({ visible: true }).first().click();
  await page.getByRole('radio', { name: 'Lista' }).filter({ visible: true }).first().click();

  // Mapa NIGDY nie była widoczna — `KadrObserwator` nie zgłosił ani jednego
  // kadru. Lista i tak ma się wypełnić (okolica Poznania/gracza).
  await expect(page.getByText('Orlik Poznań 0').filter({ visible: true }).first())
    .toBeVisible({ timeout: 15_000 });

  const licznik = page.locator('text=/\\d+ boisk/').filter({ visible: true }).first();
  await expect(licznik).toBeVisible();
  // Sześć boisk w atrapie — licznik MUSI zgadzać się z tym, co faktycznie
  // widać na liście, nie z zerem znad nietkniętego kadru mapy.
  await expect(licznik).not.toHaveText(/^0 /);
  await expect(licznik).toContainText('6 boisk');
});

test('filtry z wybraną miejscowością działają bez przełączania Mapa→Lista', async ({ page }) => {
  // Zapytanie o okolicę Krakowa jest CELOWO opóźnione — bez tego test nie
  // odróżniłby prawdziwej naprawy od zbiegu okoliczności: zapytanie zawsze
  // się kiedyś kończy, więc asercja z długim timeoutem przeszłaby nawet
  // wtedy, gdyby w MIĘDZYCZASIE stał tam mylący pusty stan z przyciskami
  // „Pokaż blisko mnie"/„Przybliż" (dokładnie to, co zobaczyła sesja QA —
  // wyglądało na trwałą usterkę, a było tylko chwilą bez informacji zwrotnej).
  let opoznijKrakow = () => {};
  const opoznienie = new Promise<void>((resolve) => { opoznijKrakow = resolve; });
  await podstaw(page, opoznienie);

  await page.goto('/mapa');
  await page.getByRole('radio', { name: 'Obiekty' }).filter({ visible: true }).first().click();
  await page.getByRole('radio', { name: 'Lista' }).filter({ visible: true }).first().click();
  // Punkt wyjścia: lista startowa (Poznań), zanim ktokolwiek wybrał miejscowość.
  await expect(page.getByText(/Orlik Poznań/).filter({ visible: true }).first())
    .toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Filtry/i }).filter({ visible: true }).first().click();
  await page.getByLabel('Miejscowość albo kod pocztowy').filter({ visible: true }).first().fill('Kraków');
  await page.getByRole('button', { name: /Kraków/ }).filter({ visible: true }).first()
    .click({ timeout: 15_000 });
  // Etykieta „Koszykówka" istnieje DWA razy w arkuszu: jako SPORT (przycisk
  // z emoji — dostępna nazwa to „🏀 Koszykówka", nie samo słowo) i jako TYP
  // OBIEKTU (`basketball_half`, bez emoji — dostępna nazwa to dokładnie
  // „Koszykówka"). Dopasowanie `exact: true` bez scopowania trafiało więc
  // w typ obiektu: filtr sportu zostawał pusty, a filtr typu wycinał całą
  // atrapę (żadna nie ma `venue_type: 'basketball_half'`) — lista wychodziła
  // pusta z powodu niezwiązanego z żadną z dwóch naprawianych tu usterek.
  const sekcjaSport = page.locator('section', { has: page.getByRole('heading', { name: 'Sport', exact: true }) })
    .filter({ visible: true }).first();
  await sekcjaSport.getByRole('button', { name: /Koszykówka/ }).click();
  await page.getByRole('button', { name: /^Pokaż \d+ boisk/i }).filter({ visible: true }).first().click();

  // W TRAKCIE zapytania: ekran ma mówić „szukam", nie oferować przyciski,
  // które nie mają nic wspólnego z tym, co użytkownik właśnie zrobił.
  await expect(page.getByText('Szukam w okolicy: Kraków')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Pokaż boiska blisko mnie/ })).toHaveCount(0);

  opoznijKrakow();

  // Po odpowiedzi — BEZ dotykania przełącznika Mapa/Lista — lista pokazuje
  // wyniki. Zgłoszony błąd: zostawała (pozornie) pusta, dopóki ktoś nie
  // przełączył na Mapę i z powrotem na Listę.
  await expect(page.getByText('Orlik Kraków 0').filter({ visible: true }).first())
    .toBeVisible({ timeout: 15_000 });
});
