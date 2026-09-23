import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ZAKAZANE_W_TSX } from '@/content/zakazaneFrazy';

// F-7 (docs/faza1-organizator-plan.md): `landingContent.test.ts` i
// `tresciStron.test.ts` skanują wyłącznie stałe z `content/*.ts` — zdania
// wpisane wprost w JSX (`app/**/*.tsx`, `components/**/*.tsx`) przeżywały
// więc kolejne porządki treści. Ten test skanuje SUROWE pliki.
const KORZEN = path.join(process.cwd(), 'src');
const KATALOGI = ['app', 'components'];

function plikiTsx(dir: string): string[] {
  const wynik: string[] = [];
  for (const wpis of readdirSync(dir)) {
    const pelna = path.join(dir, wpis);
    const info = statSync(pelna);
    if (info.isDirectory()) { wynik.push(...plikiTsx(pelna)); continue; }
    if (wpis.endsWith('.tsx') && !wpis.endsWith('.test.tsx')) wynik.push(pelna);
  }
  return wynik;
}

/** Usuwa komentarze linijkowe i blokowe (w tym `{/* … *‌/}` JSX) — ten sam
 *  uproszczony, linijkowy sposób co skaner długiego myślnika w
 *  `scripts/check-docs.mjs` (sekcja 11): komentarz tłumaczący POWÓD zakazu
 *  potrafi sam zacytować zakazaną frazę. */
function bezKomentarzy(tresc: string): string {
  let wBlokuKomentarza = false;
  return tresc
    .split('\n')
    .map((linia) => {
      if (wBlokuKomentarza) {
        if (linia.includes('*/')) wBlokuKomentarza = false;
        return '';
      }
      const przycieta = linia.trim();
      if (przycieta.startsWith('//') || przycieta.startsWith('*')) return '';
      if (linia.includes('/*') && !linia.includes('*/')) { wBlokuKomentarza = true; return ''; }
      return linia
        .replace(/\{\/\*.*?\*\/\}/g, '')
        .replace(/\/\*.*?\*\//g, '')
        .split('//')[0];
    })
    .join('\n');
}

describe('ZAKAZANE_W_TSX — obietnice bez pokrycia w JSX (F-7)', () => {
  const pliki = KATALOGI.flatMap((k) => plikiTsx(path.join(KORZEN, k)));

  it('znaleziono więcej niż garstkę plików .tsx (bramka nie skanuje pustki)', () => {
    expect(pliki.length).toBeGreaterThan(100);
  });

  for (const fraza of ZAKAZANE_W_TSX) {
    it(`żaden plik .tsx nie zawiera frazy pasującej do /${fraza}/i (poza komentarzami)`, () => {
      const wzorzec = new RegExp(fraza, 'i');
      const trafienia: string[] = [];
      for (const plik of pliki) {
        const tresc = bezKomentarzy(readFileSync(plik, 'utf8'));
        if (wzorzec.test(tresc)) trafienia.push(path.relative(KORZEN, plik));
      }
      expect(trafienia).toEqual([]);
    });
  }
});
