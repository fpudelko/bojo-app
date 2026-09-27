// The opportunity finder must find what was planted in the synthetic export
// and nothing that three impressions could fake.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wczytajEksport } from '../../../gsc/scripts/lib/raporty.mjs';
import { eksportSkutecznosci } from '../../../gsc/scripts/test/pomocnicze.mjs';
import { krzywaCtr, lukiCtr, koszyk } from '../gsc-okazje.mjs';

function dane() {
  const k = mkdtempSync(join(tmpdir(), 'okazje-'));
  const plik = join(k, 'https___www.bojo.pl_-Performance-on-Search-2026-09-14.zip');
  writeFileSync(plik, eksportSkutecznosci());
  return wczytajEksport(plik);
}

test('koszyki pozycji', () => {
  assert.equal(koszyk(1.2), '1');
  assert.equal(koszyk(2.8), '3');
  assert.equal(koszyk(7), '6–10');
  assert.equal(koszyk(35), '21+');
});

test('luka CTR znajduje obie podłożone strony i tylko je', () => {
  const r = dane();
  const strony = r.tabele.strony.wiersze;
  const luki = lukiCtr(strony, krzywaCtr(strony), 'page');
  const adresy = luki.map((l) => l.page);
  assert.ok(adresy.includes('https://www.bojo.pl/boisko/orlik-luka-aaaaaaaaaaa1'));
  assert.ok(adresy.includes('https://www.bojo.pl/boisko/hala-luka-aaaaaaaaaaa2'));
  assert.equal(luki[0].page, 'https://www.bojo.pl/boisko/orlik-luka-aaaaaaaaaaa1', 'największa strata na górze');
  assert.ok(luki.length <= 4, `za dużo fałszywych alarmów: ${luki.length}`);
});

test('mała próba nie daje „luki”', () => {
  const wiersze = [
    { page: 'a', clicks: 0, impressions: 3, position: 2 },
    ...Array.from({ length: 20 }, (_, i) => ({ page: `p${i}`, clicks: 20, impressions: 200, position: 2 })),
  ];
  assert.equal(lukiCtr(wiersze, krzywaCtr(wiersze), 'page', 1).filter((l) => l.page === 'a').length, 0);
});
