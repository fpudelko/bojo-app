import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import manifest from '@/app/manifest';

// Ikony PWA powstają ze ścieżki litery „B" SKOPIOWANEJ z `components/Logo.tsx`
// do `scripts/generuj-ikony.mjs`. Skrypt buildowy nie zaimportuje modułu TSX
// bez całego łańcucha transpilacji, więc powtórzenie jest świadome — a ten test
// jest po to, żeby obie kopie nie rozjechały się po cichu. Objaw bez niego:
// ktoś podmienia logo, ikona na ekranie telefonu zostaje stara, i nikt tego nie
// zauważa, bo ikonę widzi się raz przy instalacji.
//
// `Logo.tsx` czytamy jako TEKST, nie importujemy: import wciągnąłby JSX do
// pliku `.ts` i wywracał transformację, a i tak porównujemy tu źródła, nie
// zachowanie komponentu.
const KATALOG = process.cwd();
const skrypt = readFileSync(path.join(KATALOG, 'scripts', 'generuj-ikony.mjs'), 'utf8');
const logo = readFileSync(path.join(KATALOG, 'src', 'components', 'Logo.tsx'), 'utf8');

const bezSpacji = (s: string) => s.replace(/\s+/g, '');

describe('ikony PWA', () => {
  it('ścieżka litery w generatorze zgadza się z logo', () => {
    const zLogo = logo.match(/LOGO_SVG_STRING[\s\S]*?<path d="([^"]+)"/)?.[1];
    expect(zLogo, 'nie znaleziono ścieżki w LOGO_SVG_STRING').toBeTruthy();
    // Po zdjęciu białych znaków, bo w SVG bywa inne łamanie linii.
    expect(bezSpacji(skrypt)).toContain(bezSpacji(zLogo!));
  });

  it('zieleń w generatorze zgadza się z logo i manifestem', () => {
    expect(skrypt).toContain('#15663E');
    expect(logo).toContain('#15663E');
    expect(manifest().theme_color).toBe('#15663E');
    expect(manifest().background_color).toBe('#15663E');
  });
});

describe('manifest', () => {
  it('ma wszystko, czego przeglądarka wymaga do instalacji', () => {
    const m = manifest();
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe('/');
    // `standalone` to warunek nie tylko wyglądu apki, ale i web-pusha na iOS.
    expect(m.display).toBe('standalone');
  });

  it('short_name mieści się pod ikoną na ekranie telefonu', () => {
    // Powyżej ~12 znaków system przycina nazwę wielokropkiem.
    expect((manifest().short_name ?? '').length).toBeLessThanOrEqual(12);
  });

  it('ma ikonę 192 i 512 w wariancie zwykłym oraz maskowalnym', () => {
    const ikony = manifest().icons ?? [];
    const jest = (rozmiar: string, przeznaczenie: string) =>
      ikony.some((i) => i.sizes === rozmiar && i.purpose === przeznaczenie);

    expect(jest('192x192', 'any')).toBe(true);
    expect(jest('512x512', 'any')).toBe(true);
    // Bez wariantu maskowalnego Android przycina logo razem z rogami.
    expect(jest('192x192', 'maskable')).toBe(true);
    expect(jest('512x512', 'maskable')).toBe(true);
  });

  it('wszystkie pliki ikon istnieją w public/', () => {
    for (const ikona of manifest().icons ?? []) {
      const sciezka = path.join(KATALOG, 'public', ikona.src);
      expect(() => readFileSync(sciezka), `brak pliku ${ikona.src}`).not.toThrow();
    }
  });

  it('apple-touch-icon istnieje — iOS ignoruje ikony z manifestu', () => {
    const sciezka = path.join(KATALOG, 'public', 'ikony', 'apple-touch-icon.png');
    expect(() => readFileSync(sciezka)).not.toThrow();
  });
});
