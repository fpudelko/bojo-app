// The page-type map must stay true to the repo: every file it names exists,
// and robots.txt rules are read from robots.ts, not copied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, TYPY_STRON, klasyfikujAdres, regulyRobots, pasujeDoRobots } from '../lib/mapa-bojo.mjs';

const PRZYKLADY = {
  'https://www.bojo.pl/': 'strona-glowna',
  'https://www.bojo.pl/faq': 'tresc',
  'https://www.bojo.pl/kalkulator-kosztow-boiska': 'tresc',
  '/boisko/dubidzkie-lwy-741e4f384561': 'obiekt',
  '/boiska/pilka-nozna': 'hub-sportu',
  '/boiska/pilka-nozna/poznan': 'hub-miasta',
  '/boiska/woj/wielkopolskie': 'hub-wojewodztwa',
  '/pilka-nozna/poznan': 'sport-miasto',
  '/wydarzenia/4ca4de66-2458-429e-8c4b-90f571acef45': 'mecz',
  '/wydarzenia': 'lista',
  '/mapa': 'lista',
  '/wydarzenia/nowe': 'kreator',
  '/g/ABC123': 'kod-dolaczenia',
  '/gracze': 'gracze',
  '/sitemap-boiska/mazowieckie.xml': 'plik-techniczny',
  '/gracz/123': 'zablokowana-robots',
};

test('każdy przykładowy adres trafia w swój typ, a plik typu istnieje', () => {
  for (const [adres, typ] of Object.entries(PRZYKLADY)) {
    const k = klasyfikujAdres(adres);
    assert.equal(k.typ, typ, adres);
    if (k.plik) assert.ok(existsSync(join(ROOT, k.plik)), `${adres}: brak pliku ${k.plik}`);
  }
});

test('pliki wszystkich typów istnieją (mapa nie wskazuje w próżnię)', () => {
  for (const t of TYPY_STRON) assert.ok(existsSync(join(ROOT, t.plik)), `${t.typ}: brak ${t.plik}`);
});

test('warianty adresu obiektu: kanoniczny, UUID, historyczny', () => {
  assert.equal(klasyfikujAdres('/boisko/dubidzkie-lwy-741e4f384561').wariant, 'kanoniczny');
  assert.equal(klasyfikujAdres('/boisko/741e4f384561').wariant, 'kanoniczny');
  assert.equal(klasyfikujAdres('/boisko/4ca4de66-2458-429e-8c4b-90f571acef45').wariant, 'uuid');
  assert.equal(klasyfikujAdres('/boisko/boisko-pilkarskie').wariant, 'historyczny');
});

test('reguły robots.txt czytane z robots.ts i dopasowywane jak u Google', () => {
  const r = regulyRobots();
  assert.ok(r.includes('/d/') && r.includes('/admin'), 'lista DISALLOW z robots.ts');
  assert.ok(pasujeDoRobots('/wydarzenia/abc/edytuj', '/wydarzenia/*/edytuj'));
  assert.ok(!pasujeDoRobots('/wydarzenia/abc', '/wydarzenia/*/edytuj'));
  assert.ok(pasujeDoRobots('/turnieje/5', '/turnieje'));
  assert.equal(klasyfikujAdres('/g/XYZ').robotsZablokowany, '/g/');
  assert.equal(klasyfikujAdres('/boisko/x-741e4f384561').robotsZablokowany, null);
});

test('host jest zapamiętany (do wykrywania www/bez www)', () => {
  assert.equal(klasyfikujAdres('https://bojo.pl/faq').host, 'bojo.pl');
});
