import { test, expect } from '@playwright/test';
import { pustaBaza, TRASY } from './wspolne';

/**
 * HYDRACJA W POLSKIEJ STREFIE CZASOWEJ.
 *
 * Serwer (Vercel) renderuje w UTC, gracz jest w Warszawie. Tekst zależny od
 * „teraz” albo od strefy („Dzisiaj”, „za 2 h”) wychodzi z serwera inny niż
 * z pierwszego renderu w przeglądarce — React zgłasza #418/#425 i #423, po
 * czym wyrzuca cały HTML z serwera i renderuje stronę od nowa. Tak było ze
 * stroną główną (W-3, docs/faza1-przejscie-e2e-plan.md).
 *
 * Dlaczego osobny plik: `playwright.config.ts` nie ustawia strefy, więc każdy
 * inny test chodzi w strefie runnera (UTC w CI) — tej samej co serwer — i tej
 * klasy błędu nie zobaczy nigdy. Globalnej strefy świadomie nie zmieniamy:
 * przesunęłaby daty na wszystkich wzorcach zrzutów naraz.
 *
 * Czego ten test NIE łapie: sekcji z danymi pobieranymi NA SERWERZE (np.
 * „Możesz dołączyć już dziś”) — atrapa `page.route()` działa tylko
 * w przeglądarce, więc bez bazy ta sekcja jest pusta. Tę część pilnuje
 * `src/__tests__/kartaMeczuSsr.test.tsx`.
 */
test.use({ timezoneId: 'Europe/Warsaw', locale: 'pl-PL' });


const HYDRACJA = /Minified React error #(418|423|425)\b|Hydration failed|did not match/;

for (const [nazwa, adres] of TRASY) {
  test(`bez błędu hydracji: ${nazwa}`, async ({ page }) => {
    // Strefa nie zależy od rozmiaru okna — jeden projekt wystarczy.
    test.skip(test.info().project.name !== 'telefon', 'strefa czasowa nie zależy od urządzenia');
    const bledy: string[] = [];
    page.on('pageerror', (e) => { if (HYDRACJA.test(e.message)) bledy.push(e.message.slice(0, 120)); });
    await pustaBaza(page);
    await page.goto(adres);
    await page.waitForLoadState('networkidle');
    expect(bledy, `${adres}: React odrzucił HTML z serwera`).toEqual([]);
  });
}
