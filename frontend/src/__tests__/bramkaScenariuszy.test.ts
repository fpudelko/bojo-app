import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Bramka decyduje, czy zadanie „Scenariusze za logowaniem" świeci na czerwono.
// Pomyłka w którąkolwiek stronę jest kosztowna: fałszywa czerwień każe
// „naprawiać" zamierzoną zmianę wyglądu, a fałszywa zieleń przywraca dokładnie
// ten stan, dla którego bramka powstała — czternaście padających scenariuszy
// przy zielonym znaczku. Dlatego klasyfikacja ma własny test.
const BRAMKA = resolve(__dirname, '../../../.github/bramka-scenariuszy.mjs');

/** Uruchamia bramkę na podstawionym raporcie. Zwraca kod wyjścia i wypisany tekst. */
function uruchom(specs: unknown[]): { kod: number; tekst: string } {
  const katalog = mkdtempSync(join(tmpdir(), 'bramka-'));
  const plik = join(katalog, 'raport.json');
  writeFileSync(plik, JSON.stringify({ suites: [{ specs }] }));
  try {
    return { kod: 0, tekst: execFileSync('node', [BRAMKA, plik], { encoding: 'utf8' }) };
  } catch (e) {
    const blad = e as { status: number; stdout: string; stderr: string };
    return { kod: blad.status, tekst: `${blad.stdout ?? ''}${blad.stderr ?? ''}` };
  }
}

/** Jeden padający test w kształcie, w jakim wystawia go reporter JSON. */
const padl = (title: string, message: string) => ({
  title, file: 'e2e/scenariusze.spec.ts',
  tests: [{ status: 'unexpected', results: [{ error: { message } }] }],
});

const przeszedl = (title: string) => ({
  title, file: 'e2e/scenariusze.spec.ts',
  tests: [{ status: 'expected', results: [] }],
});

describe('bramka scenariuszy', () => {
  it('zielono, gdy wszystko przeszło', () => {
    const { kod, tekst } = uruchom([przeszedl('dołączenie do meczu')]);
    expect(kod).toBe(0);
    expect(tekst).toContain('bez zastrzeżeń');
  });

  it('zielono, gdy padło samo porównanie zrzutu', () => {
    const { kod, tekst } = uruchom([
      padl('widok konta', 'Error: expect(page).toHaveScreenshot(expected) failed\n\n  Expected an image 640px by 298px'),
    ]);
    expect(kod).toBe(0);
    expect(tekst).toContain('widok konta');
    expect(tekst).toContain('zrzuty:zaakceptuj');
  });

  it('zielono, gdy wzorca jeszcze nie ma — nowy widok nie jest regresją', () => {
    const { kod } = uruchom([
      padl('odwołany — baner', "Error: A snapshot doesn't exist at /x/mecz-odwolany.png, writing actual."),
    ]);
    expect(kod).toBe(0);
  });

  it('RAMKA KODU nie może przesądzać o werdykcie', () => {
    // Ta pomyłka realnie się zdarzyła: komunikat o zrzucie niesie sąsiednie
    // linijki testu, a w nich stało `toBeVisible` — bramka czytała je jak
    // przyczynę i uznawała czystą zmianę wyglądu za zepsute zachowanie.
    const { kod } = uruchom([
      padl('bez grup — zachęta zamiast pustki',
        'Error: expect(locator).toHaveScreenshot(expected) failed\n\n'
        + '  482 |     await expect(pusto).toBeVisible({ timeout: 20_000 });\n'
        + "> 484 |     await expect(pusto).toHaveScreenshot('grupy-pusto.png');\n"),
    ]);
    expect(kod).toBe(0);
  });

  it('czerwono, gdy padło zachowanie', () => {
    const { kod, tekst } = uruchom([
      padl('komplet — komunikat o rezerwie', 'Error: locator.click: Test timeout of 30000ms exceeded.'),
      padl('widok konta', 'Error: expect(page).toHaveScreenshot(expected) failed'),
    ]);
    expect(kod).toBe(1);
    expect(tekst).toContain('Zepsute ZACHOWANIE');
    expect(tekst).toContain('komplet — komunikat o rezerwie');
  });

  it('czerwono, gdy test padł i na zachowaniu, i na zrzucie', () => {
    const { kod } = uruchom([
      padl('skład', 'Error: expect(locator).toBeVisible() failed\n\nError: expect(locator).toHaveScreenshot(expected) failed'),
    ]);
    expect(kod).toBe(1);
  });

  it('czerwono, gdy raportu nie ma — przebieg wywrócił się przed testami', () => {
    let kod = 0;
    try {
      execFileSync('node', [BRAMKA, '/nie/ma/takiego/pliku.json'], { encoding: 'utf8' });
    } catch (e) { kod = (e as { status: number }).status; }
    expect(kod).toBe(1);
  });
});
